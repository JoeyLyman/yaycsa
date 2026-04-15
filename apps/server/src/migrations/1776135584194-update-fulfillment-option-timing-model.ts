import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateFulfillmentOptionTimingModel1776135584194 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      `UPDATE "fulfillment_option" SET "type" = 'scheduled_pickup' WHERE "type" = 'pickup'`,
      undefined,
    );
    await queryRunner.query(
      `UPDATE "fulfillment_option" SET "type" = 'scheduled_delivery' WHERE "type" = 'delivery'`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" RENAME COLUMN "description" TO "notes"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN IF EXISTS "active"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN "recurrence"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN "fulfillmentStartDate"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN "fulfillmentEndDate"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN "fulfillmentTimeDescription"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN "deadlineOffsetHours"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "fulfillmentWeekday" character varying`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "fulfillmentTimeWindowStart" integer`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "fulfillmentTimeWindowEnd" integer`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "orderDeadlineWeekday" character varying`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "orderDeadlineTime" integer`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ALTER COLUMN "type" SET DEFAULT 'scheduled_pickup'`,
      undefined,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(
      `UPDATE "fulfillment_option" SET "type" = 'pickup' WHERE "type" = 'scheduled_pickup'`,
      undefined,
    );
    await queryRunner.query(
      `UPDATE "fulfillment_option" SET "type" = 'delivery' WHERE "type" IN ('scheduled_delivery', 'shipping')`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ALTER COLUMN "type" SET DEFAULT 'pickup'`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN "orderDeadlineTime"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN "orderDeadlineWeekday"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN "fulfillmentTimeWindowEnd"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN "fulfillmentTimeWindowStart"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" DROP COLUMN "fulfillmentWeekday"`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "deadlineOffsetHours" integer`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "fulfillmentTimeDescription" text`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "fulfillmentEndDate" TIMESTAMP WITH TIME ZONE`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "fulfillmentStartDate" TIMESTAMP WITH TIME ZONE`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "recurrence" character varying`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" ADD "active" boolean NOT NULL DEFAULT true`,
      undefined,
    );
    await queryRunner.query(
      `ALTER TABLE "fulfillment_option" RENAME COLUMN "notes" TO "description"`,
      undefined,
    );
  }
}
