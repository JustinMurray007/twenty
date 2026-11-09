import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';
import {
  CompanyCamService,
  CreateProjectPayload,
} from './companycam.service';

/**
 * CompanyCam Sync Subscriber
 * Automatically spins up a matching CompanyCam Project when a roofing
 * Opportunity or Job is booked in Twenty CRM.
 */
@EventSubscriber()
export class CompanyCamSyncSubscriber
  implements EntitySubscriberInterface<OpportunityWorkspaceEntity>
{
  private companyCamService: CompanyCamService;

  constructor() {
    this.companyCamService = new CompanyCamService();
  }

  listenTo() {
    return OpportunityWorkspaceEntity;
  }

  async afterInsert(event: InsertEvent<OpportunityWorkspaceEntity>) {
    await this.handleProjectCreation(event.queryRunner, event.entity);
  }

  async afterUpdate(event: UpdateEvent<OpportunityWorkspaceEntity>) {
    const updated = event.entity;
    if (!updated) return;

    // Trigger on first move to Inspection Scheduled if not already created
    if (
      updated.stage === 'INSPECTION_SCHEDULED' ||
      updated.stage === 'NEW_LEAD'
    ) {
      await this.handleProjectCreation(event.queryRunner, updated);
    }
  }

  private async handleProjectCreation(
    queryRunner: any,
    opportunity: OpportunityWorkspaceEntity,
  ) {
    if (!opportunity || !opportunity.id) return;

    // 1. Guard: Check if companycamProjectId is already set
    const records = await queryRunner.manager.query(
      `SELECT "companycamProjectId", "name", "pointOfContactId", "companyId" 
       FROM "opportunity" 
       WHERE "id" = $1 LIMIT 1`,
      [opportunity.id],
    );

    const record = records[0];
    if (!record || record.companycamProjectId) {
      return;
    }

    // 2. Resolve Contact / Homeowner Name & Address
    let homeownerName = record.name || 'Roofing Opportunity';
    let streetAddress = '';
    let city = 'San Diego';
    let state = 'CA';
    let postalCode = '92109';

    if (record.pointOfContactId) {
      const contacts = await queryRunner.manager.query(
        `SELECT "name", "city" FROM "person" WHERE "id" = $1 LIMIT 1`,
        [record.pointOfContactId],
      );
      if (contacts[0]) {
        const contact = contacts[0];
        if (contact.name?.firstName) {
          homeownerName = `${contact.name.firstName} ${contact.name.lastName || ''}`.trim();
        }
        if (contact.city) city = contact.city;
      }
    }

    // 3. Construct CompanyCam Project Payload
    const projectName = `${streetAddress || homeownerName} - Roof Replacement`;

    const payload: CreateProjectPayload = {
      name: projectName,
      address: {
        street_address_1: streetAddress || 'Pending Inspection Address',
        city,
        state,
        postal_code: postalCode,
      },
    };

    try {
      // 4. Call CompanyCam API
      const ccProject = await this.companyCamService.createProject(payload);
      const webUrl = this.companyCamService.getProjectWebUrl(ccProject.id);

      // Attempt share link generation
      let shareUrl = webUrl;
      try {
        shareUrl = await this.companyCamService.createProjectShareLink(
          ccProject.id,
        );
      } catch (e) {
        // Fallback to webUrl
      }

      // 5. Write back to Twenty Opportunity
      await queryRunner.manager.query(
        `
        UPDATE "opportunity"
        SET 
          "companycamProjectId" = $1,
          "companycamUrl" = $2,
          "companycamShareLink" = $3,
          "updatedAt" = now()
        WHERE "id" = $4
        `,
        [ccProject.id, webUrl, shareUrl, opportunity.id],
      );

      // 6. Log Timeline Activity in Twenty
      await queryRunner.manager.query(
        `
        INSERT INTO "timeline_activity" (
          "name",
          "properties",
          "targetOpportunityId"
        ) VALUES (
          'companycam.project_created',
          $1::jsonb,
          $2
        )
        `,
        [
          JSON.stringify({
            projectId: ccProject.id,
            projectUrl: webUrl,
            message: `CompanyCam project created and linked: ${projectName}`,
          }),
          opportunity.id,
        ],
      );
    } catch (error) {
      console.error(
        `[CompanyCamSyncSubscriber] Failed to auto-provision CompanyCam project for Opportunity ${opportunity.id}:`,
        error,
      );
    }
  }
}
