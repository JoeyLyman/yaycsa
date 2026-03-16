import {MigrationInterface, QueryRunner} from "typeorm";

export class AddFacetValueGroupField1773601432300 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "facet_value" ADD "customFieldsGroup" character varying(255)`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "facet_value" DROP COLUMN "customFieldsGroup"`, undefined);
   }

}
