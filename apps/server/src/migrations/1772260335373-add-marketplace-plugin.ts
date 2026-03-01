import {MigrationInterface, QueryRunner} from "typeorm";

/**
 * Adds Customer→Seller foreign key for unified accounts (marketplace-plugin).
 *
 * Note: Seller.customFields.slug was created in an earlier offer-plugin migration
 * (1772234221121-add-seller-slug). Its registration has been moved from offer-plugin
 * to marketplace-plugin, but the DB column already exists — no schema change needed.
 */
export class AddMarketplacePlugin1772260335373 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "customer" ADD "customFieldsSellerid" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "customer" ADD CONSTRAINT "FK_f0ea1ac7f2e6b9a943944417807" FOREIGN KEY ("customFieldsSellerid") REFERENCES "seller"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "customer" DROP CONSTRAINT "FK_f0ea1ac7f2e6b9a943944417807"`, undefined);
        await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "customFieldsSellerid"`, undefined);
   }

}
