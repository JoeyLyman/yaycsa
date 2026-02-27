import {MigrationInterface, QueryRunner} from "typeorm";

export class AddSellerSlug1772234221121 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "seller" ADD "customFieldsSlug" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "seller" ADD CONSTRAINT "UQ_4ba6ad9672955d7e551e315e74e" UNIQUE ("customFieldsSlug")`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "seller" DROP CONSTRAINT "UQ_4ba6ad9672955d7e551e315e74e"`, undefined);
        await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "customFieldsSlug"`, undefined);
   }

}
