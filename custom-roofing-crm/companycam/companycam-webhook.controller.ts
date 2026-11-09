import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

export interface CompanyCamWebhookPayload {
  event: 'photo.created' | 'photo.tagged' | 'project.created' | 'project.deleted';
  data: {
    id: string;
    project_id?: string;
    company_id?: string;
    creator_name?: string;
    created_at?: number;
    captured_at?: number;
    coordinates?: { lat: number; lon: number };
    uris?: Array<{ type: string; url: string }>;
    tags?: Array<{ id: string; display_value: string }>;
    has_annotations?: boolean;
    name?: string;
  };
}

@Controller('webhooks/companycam')
export class CompanyCamWebhookController {
  private readonly logger = new Logger(CompanyCamWebhookController.name);

  constructor(private readonly dataSource: DataSource) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async handleCompanyCamWebhook(
    @Body() payload: CompanyCamWebhookPayload,
    @Headers('x-companycam-signature') signature?: string,
  ) {
    if (!payload || !payload.event) {
      throw new BadRequestException('Invalid webhook event payload');
    }

    this.logger.log(`Received CompanyCam webhook: ${payload.event}`);

    switch (payload.event) {
      case 'photo.created':
      case 'photo.tagged':
        await this.handlePhotoEvent(payload.data, payload.event);
        break;

      case 'project.created':
        this.logger.log(
          `Project created event received for project ${payload.data?.id}`,
        );
        break;

      default:
        this.logger.debug(`Unhandled CompanyCam event: ${payload.event}`);
    }

    return { status: 'acknowledged' };
  }

  private async handlePhotoEvent(
    data: CompanyCamWebhookPayload['data'],
    eventName: string,
  ) {
    const projectId = data.project_id;
    if (!projectId) return;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Locate matching Opportunity and Job in Twenty
      const opportunities = await queryRunner.manager.query(
        `SELECT "id" FROM "opportunity" WHERE "companycamProjectId" = $1 LIMIT 1`,
        [projectId],
      );
      const jobs = await queryRunner.manager.query(
        `SELECT "id" FROM "job" WHERE "companycamProjectId" = $1 LIMIT 1`,
        [projectId],
      );

      const opportunityId = opportunities[0]?.id || null;
      const jobId = jobs[0]?.id || null;

      // Extract photo URLs
      const thumbUrl =
        data.uris?.find((u) => u.type === 'thumbnail')?.url ||
        data.uris?.[0]?.url ||
        '';
      const previewUrl =
        data.uris?.find((u) => u.type === 'medium')?.url ||
        data.uris?.[0]?.url ||
        '';
      const originalUrl =
        data.uris?.find((u) => u.type === 'original')?.url ||
        data.uris?.[0]?.url ||
        '';

      const tagNames = data.tags?.map((t) => t.display_value) || [];

      // 2. Cache photo metadata in companycam_photo
      await queryRunner.manager.query(
        `
        INSERT INTO "companycam_photo" (
          "companycamPhotoId",
          "companycamProjectId",
          "opportunityId",
          "jobId",
          "thumbnailUrl",
          "previewUrl",
          "originalUrl",
          "capturedAt",
          "creatorName",
          "latitude",
          "longitude",
          "hasAnnotations",
          "tags"
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, TO_TIMESTAMP($8), $9, $10, $11, $12, $13::jsonb)
        ON CONFLICT ("companycamPhotoId") DO UPDATE
        SET 
          "tags" = EXCLUDED."tags",
          "hasAnnotations" = EXCLUDED."hasAnnotations",
          "updatedAt" = now()
        `,
        [
          data.id,
          projectId,
          opportunityId,
          jobId,
          thumbUrl,
          previewUrl,
          originalUrl,
          data.captured_at || Math.floor(Date.now() / 1000),
          data.creator_name || 'Field Technician',
          data.coordinates?.lat || null,
          data.coordinates?.lon || null,
          data.has_annotations || false,
          JSON.stringify(tagNames),
        ],
      );

      // 3. Increment photo count & update cover on Opportunity & Job
      if (opportunityId) {
        await queryRunner.manager.query(
          `
          UPDATE "opportunity"
          SET 
            "companycamPhotoCount" = COALESCE("companycamPhotoCount", 0) + 1,
            "companycamCoverPhotoUrl" = COALESCE("companycamCoverPhotoUrl", $1),
            "updatedAt" = now()
          WHERE "id" = $2
          `,
          [previewUrl, opportunityId],
        );
      }

      if (jobId) {
        await queryRunner.manager.query(
          `
          UPDATE "job"
          SET 
            "companycamPhotoCount" = COALESCE("companycamPhotoCount", 0) + 1,
            "companycamCoverPhotoUrl" = COALESCE("companycamCoverPhotoUrl", $1),
            "updatedAt" = now()
          WHERE "id" = $2
          `,
          [previewUrl, jobId],
        );
      }

      await queryRunner.commitTransaction();
      this.logger.log(
        `Successfully synced CompanyCam photo ${data.id} to Twenty (Opp: ${opportunityId}, Job: ${jobId})`,
      );
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error saving CompanyCam photo webhook for project ${projectId}:`,
        err,
      );
    } finally {
      await queryRunner.release();
    }
  }
}
