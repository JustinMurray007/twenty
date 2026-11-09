import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  UpdateEvent,
} from 'typeorm';
import { OpportunityWorkspaceEntity } from 'src/modules/opportunity/standard-objects/opportunity.workspace-entity';

/**
 * Roofing Pipeline Subscriber:
 * Bridges Opportunity (Sales) to Job (Production)
 * Automatically triggers when Opportunity.stage transitions to 'CONTRACT_SIGNED'
 */
@EventSubscriber()
export class RoofingPipelineSubscriber
  implements EntitySubscriberInterface<OpportunityWorkspaceEntity>
{
  listenTo() {
    return OpportunityWorkspaceEntity;
  }

  async afterUpdate(event: UpdateEvent<OpportunityWorkspaceEntity>) {
    const updatedEntity = event.entity;
    const databaseEntity = event.databaseEntity;

    if (!updatedEntity || !databaseEntity) {
      return;
    }

    const previousStage = databaseEntity.stage;
    const currentStage = updatedEntity.stage;

    // Detect transition into Contract Signed
    const isContractSigned =
      currentStage === 'CONTRACT_SIGNED' || currentStage === 'Contract Signed';
    const wasAlreadySigned =
      previousStage === 'CONTRACT_SIGNED' || previousStage === 'Contract Signed';

    if (isContractSigned && !wasAlreadySigned) {
      await this.createProductionJobFromOpportunity(event, updatedEntity);
    }
  }

  private async createProductionJobFromOpportunity(
    event: UpdateEvent<OpportunityWorkspaceEntity>,
    opportunity: OpportunityWorkspaceEntity,
  ) {
    const queryRunner = event.queryRunner;
    const manager = queryRunner.manager;

    // 1. Guard against duplicate production job creation
    const existingJob = await manager.query(
      `SELECT id FROM "job" WHERE "opportunityId" = $1 LIMIT 1`,
      [opportunity.id],
    );

    if (existingJob && existingJob.length > 0) {
      return;
    }

    // 2. Format Job Number: JOB-YYYYMM-XXXX
    const datePrefix = new Date().toISOString().slice(0, 7).replace('-', '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const jobNumber = `JOB-${datePrefix}-${randomSuffix}`;

    const title = `Roof Replacement - ${opportunity.name || 'Sold Customer'}`;
    const initialStage = 'MATERIAL_ORDERED';

    // 3. Insert Production Job
    const insertJobResult = await manager.query(
      `
      INSERT INTO "job" (
        "opportunityId",
        "jobNumber",
        "title",
        "stage",
        "homeownerName",
        "roofSquares",
        "scopeOfWork"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING "id"
      `,
      [
        opportunity.id,
        jobNumber,
        title,
        initialStage,
        opportunity.name,
        (opportunity as any).roofSquares || 0.0,
        `Contract Signed. Auto-transferred to Production Pipeline. Initial stage: Material Ordered.`,
      ],
    );

    const newJobId = insertJobResult[0]?.id;

    if (newJobId) {
      // 4. Provision Initial Work Order
      await manager.query(
        `
        INSERT INTO "work_order" (
          "jobId",
          "workOrderNumber",
          "subcontractorCrewLead",
          "specialInstructions"
        ) VALUES ($1, $2, $3, $4)
        `,
        [
          newJobId,
          `WO-${jobNumber}`,
          'Pending Subcontractor Assignment',
          'Coordinate rooftop delivery with supplier and schedule dumpster drop 24h prior to crew arrival.',
        ],
      );
    }
  }
}
