import { MigrationInterface, QueryRunner } from "typeorm";

export class DropFulfillmentOptionActive1776039100000 implements MigrationInterface {
  name = "DropFulfillmentOptionActive1776039100000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fulfillment_option" DROP COLUMN IF EXISTS "active"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "fulfillment_option" ADD COLUMN "active" boolean NOT NULL DEFAULT true`);
  }
}
