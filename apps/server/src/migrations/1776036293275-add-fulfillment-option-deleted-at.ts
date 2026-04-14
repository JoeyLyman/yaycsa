import { MigrationInterface, QueryRunner } from "typeorm";

export class AddFulfillmentOptionDeletedAt1776036293275 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`ALTER TABLE "fulfillment_option" ADD "deletedAt" TIMESTAMPTZ`, undefined);
  }

  public async down(queryRunner: QueryRunner): Promise<any> {
    await queryRunner.query(`ALTER TABLE "fulfillment_option" DROP COLUMN "deletedAt"`, undefined);
  }
}
