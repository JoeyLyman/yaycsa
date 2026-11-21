import {MigrationInterface, QueryRunner} from "typeorm";
import { deduplicateTranslations, migrateAssetTranslationData } from "@vendure/core";

export class Vendure38Upgrade1795290195888 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        // Remove any duplicate (baseId, languageCode) translation rows left over from before the
        // unique constraint existed, keeping the most recently updated row of each pair. This must
        // run before the constraint is created below. See https://github.com/vendurehq/vendure/issues/4884
        await deduplicateTranslations(queryRunner, ["collection_translation", "facet_translation", "facet_value_translation", "product_option_translation", "product_option_group_translation", "product_translation", "promotion_translation", "shipping_method_translation", "product_variant_translation", "region_translation", "payment_method_translation"]);
        await queryRunner.query(`ALTER TABLE "product_option_group" DROP CONSTRAINT "FK_a6e91739227bf4d442f23c52c75"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_a6e91739227bf4d442f23c52c7"`, undefined);
        await queryRunner.query(`CREATE TABLE "asset_translation" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "languageCode" character varying NOT NULL, "name" character varying NOT NULL, "id" SERIAL NOT NULL, "baseId" integer, CONSTRAINT "UQ_0dad4e3837a685fea5062da3d96" UNIQUE ("languageCode", "baseId"), CONSTRAINT "PK_2f22e63eefeef14d245bdb956b6" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_4eed4464adef51f53e1c7d8021" ON "asset_translation" ("baseId") `, undefined);
        // Hand-edited (Vendure 3.6 asset translations): the generator renamed asset."name" to "usage",
        // which would put old asset names into "usage". Vendure's documented order is: create
        // asset_translation, copy names into it, then drop "name" and add "usage" (default LIBRARY).
        await migrateAssetTranslationData(queryRunner);
        await queryRunner.query(`ALTER TABLE "asset" DROP COLUMN "name"`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" ADD "usage" character varying NOT NULL DEFAULT 'LIBRARY'`, undefined);
        await queryRunner.query(`CREATE TABLE "api_key" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "lookupId" character varying NOT NULL, "apiKeyHash" character varying NOT NULL, "lastUsedAt" TIMESTAMP, "apiType" character varying, "deletedAt" TIMESTAMP, "id" SERIAL NOT NULL, "ownerId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "UQ_ade30668b991772489bf875be5f" UNIQUE ("lookupId"), CONSTRAINT "UQ_3c254ac4ce1a6d4a26da30c5575" UNIQUE ("apiKeyHash"), CONSTRAINT "PK_b1bd840641b8acbaad89c3d8d11" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE TABLE "api_key_translation" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "languageCode" character varying NOT NULL, "name" character varying NOT NULL, "id" SERIAL NOT NULL, "baseId" integer, CONSTRAINT "UQ_0a5a4e1c3fb9547a20f34ef2240" UNIQUE ("languageCode", "baseId"), CONSTRAINT "PK_b703f4951cec9da71354120bd8a" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_bf45bd67c7b3278d7e1f2f9517" ON "api_key_translation" ("baseId") `, undefined);
        await queryRunner.query(`CREATE TABLE "seller_translation" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "languageCode" character varying NOT NULL, "id" SERIAL NOT NULL, "baseId" integer, CONSTRAINT "UQ_56d8e1ae8ffbb4dd28e1da595f9" UNIQUE ("languageCode", "baseId"), CONSTRAINT "PK_26aacf907d08a9990c5de57c44c" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_f54f9a5767b186b6dc21bbdee0" ON "seller_translation" ("baseId") `, undefined);
        await queryRunner.query(`CREATE TABLE "product_option_channels_channel" ("productOptionId" integer NOT NULL, "channelId" integer NOT NULL, CONSTRAINT "PK_be681a3bd2f92f17d084fa4375a" PRIMARY KEY ("productOptionId", "channelId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_8dbe001861ca34ae8b687e6bae" ON "product_option_channels_channel" ("productOptionId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_717e7792b8f31c319b6c7b8135" ON "product_option_channels_channel" ("channelId") `, undefined);
        await queryRunner.query(`CREATE TABLE "product_option_group_channels_channel" ("productOptionGroupId" integer NOT NULL, "channelId" integer NOT NULL, CONSTRAINT "PK_ddad9696c49ebbc8032caf76fe3" PRIMARY KEY ("productOptionGroupId", "channelId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_4fbe6303db2827370c0ec2d027" ON "product_option_group_channels_channel" ("productOptionGroupId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d689965b8c58ebf316fce60fab" ON "product_option_group_channels_channel" ("channelId") `, undefined);
        await queryRunner.query(`CREATE TABLE "product_option_groups_product_option_group" ("productId" integer NOT NULL, "productOptionGroupId" integer NOT NULL, CONSTRAINT "PK_6a7a0291e226fbb0d4df828a483" PRIMARY KEY ("productId", "productOptionGroupId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_9148fe2c2fd83f5b59d391088c" ON "product_option_groups_product_option_group" ("productId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_9b03a92219b0684dbd4403e624" ON "product_option_groups_product_option_group" ("productOptionGroupId") `, undefined);
        await queryRunner.query(`CREATE TABLE "api_key_channels_channel" ("apiKeyId" integer NOT NULL, "channelId" integer NOT NULL, CONSTRAINT "PK_acb0650ccd9b2df593d1b4f1c52" PRIMARY KEY ("apiKeyId", "channelId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_460b1afc096014ca2dc5a5f5aa" ON "api_key_channels_channel" ("apiKeyId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_d37be6b22047f56ea87bea795b" ON "api_key_channels_channel" ("channelId") `, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group" DROP COLUMN "productId"`, undefined);
        await queryRunner.query(`ALTER TABLE "refund" ADD "destination" character varying`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD "pricingUpdatedAt" TIMESTAMP(6)`, undefined);
        await queryRunner.query(`ALTER TABLE "session" ADD "apiType" character varying`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" ADD "avatarId" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" ADD CONSTRAINT "UQ_28780e360e41381e695284b4a03" UNIQUE ("avatarId")`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" DROP CONSTRAINT "UQ_154f5c538b1576ccc277b1ed631"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_94e15d5f12d355d117390131ac" ON "stock_movement" ("discriminator") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_f1b165529ffe0c2cea399e25dd" ON "region" ("discriminator") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_e5598363000cab9d9116bd5835" ON "session" ("type") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_f3a761f6bcfabb474b11e1e51f" ON "history_entry" ("discriminator") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_6df70f3f2a566bcdf23c3a211a" ON "search_index_item" ("productId") `, undefined);
        await queryRunner.query(`ALTER TABLE "collection_translation" ADD CONSTRAINT "UQ_858c112351f7714960a2dfcff91" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "facet_translation" ADD CONSTRAINT "UQ_c9174d39ac643e5f14b73ad6cb5" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "facet_value_translation" ADD CONSTRAINT "UQ_084f223aa69bcd7683e727e3130" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_translation" ADD CONSTRAINT "UQ_bd426ff614344b6759d327fe58c" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group_translation" ADD CONSTRAINT "UQ_bb3992fff02944c061363d9d015" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "product_translation" ADD CONSTRAINT "UQ_dcc35f0d2b8d422634e878b813c" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "promotion_translation" ADD CONSTRAINT "UQ_0d74bcbf35d65e5d7c2a7947ae1" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "shipping_method_translation" ADD CONSTRAINT "UQ_6f2a231486b87fd9d337bf9d60b" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant_translation" ADD CONSTRAINT "UQ_33042b9e7ea5dcf5ec09a5a4130" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "region_translation" ADD CONSTRAINT "UQ_fc1a4a3618bcd16cc50dd50dfeb" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "payment_method_translation" ADD CONSTRAINT "UQ_5ee20e71a427f7d86e921083777" UNIQUE ("languageCode", "baseId")`, undefined);
        await queryRunner.query(`ALTER TABLE "asset_translation" ADD CONSTRAINT "FK_4eed4464adef51f53e1c7d80212" FOREIGN KEY ("baseId") REFERENCES "asset"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" ADD CONSTRAINT "FK_28780e360e41381e695284b4a03" FOREIGN KEY ("avatarId") REFERENCES "asset"("id") ON DELETE SET NULL ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key" ADD CONSTRAINT "FK_74d2236b1de818d00bd3fd01602" FOREIGN KEY ("ownerId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key" ADD CONSTRAINT "FK_277972f4944205eb29127f9bb6c" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key_translation" ADD CONSTRAINT "FK_bf45bd67c7b3278d7e1f2f95170" FOREIGN KEY ("baseId") REFERENCES "api_key"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "seller_translation" ADD CONSTRAINT "FK_f54f9a5767b186b6dc21bbdee0b" FOREIGN KEY ("baseId") REFERENCES "seller"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_channels_channel" ADD CONSTRAINT "FK_8dbe001861ca34ae8b687e6baef" FOREIGN KEY ("productOptionId") REFERENCES "product_option"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_channels_channel" ADD CONSTRAINT "FK_717e7792b8f31c319b6c7b81352" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group_channels_channel" ADD CONSTRAINT "FK_4fbe6303db2827370c0ec2d0276" FOREIGN KEY ("productOptionGroupId") REFERENCES "product_option_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group_channels_channel" ADD CONSTRAINT "FK_d689965b8c58ebf316fce60fab2" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_groups_product_option_group" ADD CONSTRAINT "FK_9148fe2c2fd83f5b59d391088c5" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_groups_product_option_group" ADD CONSTRAINT "FK_9b03a92219b0684dbd4403e6246" FOREIGN KEY ("productOptionGroupId") REFERENCES "product_option_group"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key_channels_channel" ADD CONSTRAINT "FK_460b1afc096014ca2dc5a5f5aa9" FOREIGN KEY ("apiKeyId") REFERENCES "api_key"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key_channels_channel" ADD CONSTRAINT "FK_d37be6b22047f56ea87bea795b6" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "api_key_channels_channel" DROP CONSTRAINT "FK_d37be6b22047f56ea87bea795b6"`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key_channels_channel" DROP CONSTRAINT "FK_460b1afc096014ca2dc5a5f5aa9"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_groups_product_option_group" DROP CONSTRAINT "FK_9b03a92219b0684dbd4403e6246"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_groups_product_option_group" DROP CONSTRAINT "FK_9148fe2c2fd83f5b59d391088c5"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group_channels_channel" DROP CONSTRAINT "FK_d689965b8c58ebf316fce60fab2"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group_channels_channel" DROP CONSTRAINT "FK_4fbe6303db2827370c0ec2d0276"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_channels_channel" DROP CONSTRAINT "FK_717e7792b8f31c319b6c7b81352"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_channels_channel" DROP CONSTRAINT "FK_8dbe001861ca34ae8b687e6baef"`, undefined);
        await queryRunner.query(`ALTER TABLE "seller_translation" DROP CONSTRAINT "FK_f54f9a5767b186b6dc21bbdee0b"`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key_translation" DROP CONSTRAINT "FK_bf45bd67c7b3278d7e1f2f95170"`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key" DROP CONSTRAINT "FK_277972f4944205eb29127f9bb6c"`, undefined);
        await queryRunner.query(`ALTER TABLE "api_key" DROP CONSTRAINT "FK_74d2236b1de818d00bd3fd01602"`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" DROP CONSTRAINT "FK_28780e360e41381e695284b4a03"`, undefined);
        await queryRunner.query(`ALTER TABLE "asset_translation" DROP CONSTRAINT "FK_4eed4464adef51f53e1c7d80212"`, undefined);
        await queryRunner.query(`ALTER TABLE "payment_method_translation" DROP CONSTRAINT "UQ_5ee20e71a427f7d86e921083777"`, undefined);
        await queryRunner.query(`ALTER TABLE "region_translation" DROP CONSTRAINT "UQ_fc1a4a3618bcd16cc50dd50dfeb"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant_translation" DROP CONSTRAINT "UQ_33042b9e7ea5dcf5ec09a5a4130"`, undefined);
        await queryRunner.query(`ALTER TABLE "shipping_method_translation" DROP CONSTRAINT "UQ_6f2a231486b87fd9d337bf9d60b"`, undefined);
        await queryRunner.query(`ALTER TABLE "promotion_translation" DROP CONSTRAINT "UQ_0d74bcbf35d65e5d7c2a7947ae1"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_translation" DROP CONSTRAINT "UQ_dcc35f0d2b8d422634e878b813c"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group_translation" DROP CONSTRAINT "UQ_bb3992fff02944c061363d9d015"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_translation" DROP CONSTRAINT "UQ_bd426ff614344b6759d327fe58c"`, undefined);
        await queryRunner.query(`ALTER TABLE "facet_value_translation" DROP CONSTRAINT "UQ_084f223aa69bcd7683e727e3130"`, undefined);
        await queryRunner.query(`ALTER TABLE "facet_translation" DROP CONSTRAINT "UQ_c9174d39ac643e5f14b73ad6cb5"`, undefined);
        await queryRunner.query(`ALTER TABLE "collection_translation" DROP CONSTRAINT "UQ_858c112351f7714960a2dfcff91"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_6df70f3f2a566bcdf23c3a211a"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_f3a761f6bcfabb474b11e1e51f"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_e5598363000cab9d9116bd5835"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_f1b165529ffe0c2cea399e25dd"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_94e15d5f12d355d117390131ac"`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" ADD CONSTRAINT "UQ_154f5c538b1576ccc277b1ed631" UNIQUE ("emailAddress")`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" ALTER COLUMN "usage" DROP DEFAULT`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" DROP CONSTRAINT "UQ_28780e360e41381e695284b4a03"`, undefined);
        await queryRunner.query(`ALTER TABLE "administrator" DROP COLUMN "avatarId"`, undefined);
        await queryRunner.query(`ALTER TABLE "session" DROP COLUMN "apiType"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "pricingUpdatedAt"`, undefined);
        await queryRunner.query(`ALTER TABLE "refund" DROP COLUMN "destination"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group" ADD "productId" integer`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_d37be6b22047f56ea87bea795b"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_460b1afc096014ca2dc5a5f5aa"`, undefined);
        await queryRunner.query(`DROP TABLE "api_key_channels_channel"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_9b03a92219b0684dbd4403e624"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_9148fe2c2fd83f5b59d391088c"`, undefined);
        await queryRunner.query(`DROP TABLE "product_option_groups_product_option_group"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_d689965b8c58ebf316fce60fab"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_4fbe6303db2827370c0ec2d027"`, undefined);
        await queryRunner.query(`DROP TABLE "product_option_group_channels_channel"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_717e7792b8f31c319b6c7b8135"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_8dbe001861ca34ae8b687e6bae"`, undefined);
        await queryRunner.query(`DROP TABLE "product_option_channels_channel"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_f54f9a5767b186b6dc21bbdee0"`, undefined);
        await queryRunner.query(`DROP TABLE "seller_translation"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_bf45bd67c7b3278d7e1f2f9517"`, undefined);
        await queryRunner.query(`DROP TABLE "api_key_translation"`, undefined);
        await queryRunner.query(`DROP TABLE "api_key"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_4eed4464adef51f53e1c7d8021"`, undefined);
        await queryRunner.query(`DROP TABLE "asset_translation"`, undefined);
        await queryRunner.query(`ALTER TABLE "asset" RENAME COLUMN "usage" TO "name"`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_a6e91739227bf4d442f23c52c7" ON "product_option_group" ("productId") `, undefined);
        await queryRunner.query(`ALTER TABLE "product_option_group" ADD CONSTRAINT "FK_a6e91739227bf4d442f23c52c75" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
   }

}
