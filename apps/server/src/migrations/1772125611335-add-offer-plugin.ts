import {MigrationInterface, QueryRunner} from "typeorm";

export class AddOfferPlugin1772125611335 implements MigrationInterface {

   public async up(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`CREATE TABLE "fulfillment_option" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "code" character varying NOT NULL, "name" character varying NOT NULL, "type" character varying NOT NULL DEFAULT 'pickup', "description" text, "active" boolean NOT NULL DEFAULT true, "sortOrder" integer NOT NULL DEFAULT '0', "recurrence" character varying, "fulfillmentStartDate" TIMESTAMP WITH TIME ZONE, "fulfillmentEndDate" TIMESTAMP WITH TIME ZONE, "fulfillmentTimeDescription" text, "deadlineOffsetHours" integer, "id" SERIAL NOT NULL, "sellerId" integer NOT NULL, CONSTRAINT "PK_d6ed321b6337f5492df7817e060" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_93628f6f78e752e45f93821d8d" ON "fulfillment_option" ("sellerId") `, undefined);
        await queryRunner.query(`CREATE TABLE "offer_line_item" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "price" integer NOT NULL, "priceIncludesTax" boolean NOT NULL DEFAULT false, "pricingMode" character varying NOT NULL DEFAULT 'tiered', "priceTiers" jsonb, "quantityLimitMode" character varying NOT NULL DEFAULT 'unlimited', "quantityLimit" integer, "autoConfirm" boolean NOT NULL DEFAULT false, "notes" text, "sortOrder" integer NOT NULL DEFAULT '0', "id" SERIAL NOT NULL, "offerId" integer NOT NULL, "productVariantId" integer NOT NULL, CONSTRAINT "PK_a03257d7209f2bc1eb3aa2bb968" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_f0c80fd4ce65f33f3e419fa7cb" ON "offer_line_item" ("offerId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ec49deb165cfdeea5b9668adb5" ON "offer_line_item" ("productVariantId") `, undefined);
        await queryRunner.query(`CREATE TABLE "offer" ("createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "status" character varying NOT NULL DEFAULT 'draft', "validFrom" TIMESTAMP WITH TIME ZONE NOT NULL, "validUntil" TIMESTAMP WITH TIME ZONE, "allowLateOrders" boolean NOT NULL DEFAULT true, "notes" text, "internalNotes" text, "id" SERIAL NOT NULL, "sellerId" integer NOT NULL, CONSTRAINT "PK_57c6ae1abe49201919ef68de900" PRIMARY KEY ("id"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_c570c1bd300dcb14fde34499f0" ON "offer" ("sellerId") `, undefined);
        await queryRunner.query(`CREATE TABLE "fulfillment_option_channels_channel" ("fulfillmentOptionId" integer NOT NULL, "channelId" integer NOT NULL, CONSTRAINT "PK_37d2cf1b1794fc4ffd0450a7dab" PRIMARY KEY ("fulfillmentOptionId", "channelId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_21b1c670c82dcd9dda97d1a69d" ON "fulfillment_option_channels_channel" ("fulfillmentOptionId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_3f13cbfa99a53b46cbd129dc38" ON "fulfillment_option_channels_channel" ("channelId") `, undefined);
        await queryRunner.query(`CREATE TABLE "offer_channels_channel" ("offerId" integer NOT NULL, "channelId" integer NOT NULL, CONSTRAINT "PK_cccf6e4f22b6879a4107d4f941a" PRIMARY KEY ("offerId", "channelId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_b7ed9499e522895acef5afae21" ON "offer_channels_channel" ("offerId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_ff1fb17a767cf6b8acbcaa53f2" ON "offer_channels_channel" ("channelId") `, undefined);
        await queryRunner.query(`CREATE TABLE "offer_customer_group_filters_customer_group" ("offerId" integer NOT NULL, "customerGroupId" integer NOT NULL, CONSTRAINT "PK_b2341b33a443d18bccf726dca2a" PRIMARY KEY ("offerId", "customerGroupId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_75ca2cb2eb7b814786ba55c4f3" ON "offer_customer_group_filters_customer_group" ("offerId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_bc4a26084b4edb0fbc45a05163" ON "offer_customer_group_filters_customer_group" ("customerGroupId") `, undefined);
        await queryRunner.query(`CREATE TABLE "offer_fulfillment_options_fulfillment_option" ("offerId" integer NOT NULL, "fulfillmentOptionId" integer NOT NULL, CONSTRAINT "PK_aaf610dda73b7eb4b8999e2fd5e" PRIMARY KEY ("offerId", "fulfillmentOptionId"))`, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_549459c6d4b363a13163cc8f03" ON "offer_fulfillment_options_fulfillment_option" ("offerId") `, undefined);
        await queryRunner.query(`CREATE INDEX "IDX_5affe64e2c01f509f906853b8a" ON "offer_fulfillment_options_fulfillment_option" ("fulfillmentOptionId") `, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD "customFieldsOfferid" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD "customFieldsFulfillmentoptionid" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD "customFields__fix_relational_custom_fields__" boolean`, undefined);
        await queryRunner.query(`COMMENT ON COLUMN "order"."customFields__fix_relational_custom_fields__" IS 'A work-around needed when only relational custom fields are defined on an entity'`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsOfferlineitemid" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsLinestatus" character varying(255) NOT NULL DEFAULT 'pending'`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsSelectedcasequantity" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsAgreedunitprice" integer`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" ADD "customFieldsBuyernotes" text`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" ADD "customFieldsUnittype" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "customer_group" ADD "customFieldsSellerid" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "customer" ADD "customFieldsNotes" text`, undefined);
        await queryRunner.query(`ALTER TABLE "seller" ADD "customFieldsTimezone" character varying(255)`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD CONSTRAINT "FK_369c63b12bf1e6a6086e4111ee0" FOREIGN KEY ("customFieldsOfferid") REFERENCES "offer"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "order" ADD CONSTRAINT "FK_47dea2f5b43648b1bc317a329a0" FOREIGN KEY ("customFieldsFulfillmentoptionid") REFERENCES "fulfillment_option"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" ADD CONSTRAINT "FK_9afa07045c57bacacb67ea50e07" FOREIGN KEY ("customFieldsOfferlineitemid") REFERENCES "offer_line_item"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "fulfillment_option" ADD CONSTRAINT "FK_93628f6f78e752e45f93821d8d5" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_line_item" ADD CONSTRAINT "FK_f0c80fd4ce65f33f3e419fa7cb3" FOREIGN KEY ("offerId") REFERENCES "offer"("id") ON DELETE CASCADE ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_line_item" ADD CONSTRAINT "FK_ec49deb165cfdeea5b9668adb5e" FOREIGN KEY ("productVariantId") REFERENCES "product_variant"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "offer" ADD CONSTRAINT "FK_c570c1bd300dcb14fde34499f05" FOREIGN KEY ("sellerId") REFERENCES "seller"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`, undefined);
        await queryRunner.query(`ALTER TABLE "fulfillment_option_channels_channel" ADD CONSTRAINT "FK_21b1c670c82dcd9dda97d1a69d1" FOREIGN KEY ("fulfillmentOptionId") REFERENCES "fulfillment_option"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "fulfillment_option_channels_channel" ADD CONSTRAINT "FK_3f13cbfa99a53b46cbd129dc388" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_channels_channel" ADD CONSTRAINT "FK_b7ed9499e522895acef5afae211" FOREIGN KEY ("offerId") REFERENCES "offer"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_channels_channel" ADD CONSTRAINT "FK_ff1fb17a767cf6b8acbcaa53f2f" FOREIGN KEY ("channelId") REFERENCES "channel"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_customer_group_filters_customer_group" ADD CONSTRAINT "FK_75ca2cb2eb7b814786ba55c4f37" FOREIGN KEY ("offerId") REFERENCES "offer"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_customer_group_filters_customer_group" ADD CONSTRAINT "FK_bc4a26084b4edb0fbc45a05163c" FOREIGN KEY ("customerGroupId") REFERENCES "customer_group"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_fulfillment_options_fulfillment_option" ADD CONSTRAINT "FK_549459c6d4b363a13163cc8f03d" FOREIGN KEY ("offerId") REFERENCES "offer"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_fulfillment_options_fulfillment_option" ADD CONSTRAINT "FK_5affe64e2c01f509f906853b8a7" FOREIGN KEY ("fulfillmentOptionId") REFERENCES "fulfillment_option"("id") ON DELETE CASCADE ON UPDATE CASCADE`, undefined);
   }

   public async down(queryRunner: QueryRunner): Promise<any> {
        await queryRunner.query(`ALTER TABLE "offer_fulfillment_options_fulfillment_option" DROP CONSTRAINT "FK_5affe64e2c01f509f906853b8a7"`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_fulfillment_options_fulfillment_option" DROP CONSTRAINT "FK_549459c6d4b363a13163cc8f03d"`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_customer_group_filters_customer_group" DROP CONSTRAINT "FK_bc4a26084b4edb0fbc45a05163c"`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_customer_group_filters_customer_group" DROP CONSTRAINT "FK_75ca2cb2eb7b814786ba55c4f37"`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_channels_channel" DROP CONSTRAINT "FK_ff1fb17a767cf6b8acbcaa53f2f"`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_channels_channel" DROP CONSTRAINT "FK_b7ed9499e522895acef5afae211"`, undefined);
        await queryRunner.query(`ALTER TABLE "fulfillment_option_channels_channel" DROP CONSTRAINT "FK_3f13cbfa99a53b46cbd129dc388"`, undefined);
        await queryRunner.query(`ALTER TABLE "fulfillment_option_channels_channel" DROP CONSTRAINT "FK_21b1c670c82dcd9dda97d1a69d1"`, undefined);
        await queryRunner.query(`ALTER TABLE "offer" DROP CONSTRAINT "FK_c570c1bd300dcb14fde34499f05"`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_line_item" DROP CONSTRAINT "FK_ec49deb165cfdeea5b9668adb5e"`, undefined);
        await queryRunner.query(`ALTER TABLE "offer_line_item" DROP CONSTRAINT "FK_f0c80fd4ce65f33f3e419fa7cb3"`, undefined);
        await queryRunner.query(`ALTER TABLE "fulfillment_option" DROP CONSTRAINT "FK_93628f6f78e752e45f93821d8d5"`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" DROP CONSTRAINT "FK_9afa07045c57bacacb67ea50e07"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_47dea2f5b43648b1bc317a329a0"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP CONSTRAINT "FK_369c63b12bf1e6a6086e4111ee0"`, undefined);
        await queryRunner.query(`ALTER TABLE "seller" DROP COLUMN "customFieldsTimezone"`, undefined);
        await queryRunner.query(`ALTER TABLE "customer" DROP COLUMN "customFieldsNotes"`, undefined);
        await queryRunner.query(`ALTER TABLE "customer_group" DROP COLUMN "customFieldsSellerid"`, undefined);
        await queryRunner.query(`ALTER TABLE "product_variant" DROP COLUMN "customFieldsUnittype"`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsBuyernotes"`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsAgreedunitprice"`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsSelectedcasequantity"`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsLinestatus"`, undefined);
        await queryRunner.query(`ALTER TABLE "order_line" DROP COLUMN "customFieldsOfferlineitemid"`, undefined);
        await queryRunner.query(`COMMENT ON COLUMN "order"."customFields__fix_relational_custom_fields__" IS 'A work-around needed when only relational custom fields are defined on an entity'`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "customFields__fix_relational_custom_fields__"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "customFieldsFulfillmentoptionid"`, undefined);
        await queryRunner.query(`ALTER TABLE "order" DROP COLUMN "customFieldsOfferid"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_5affe64e2c01f509f906853b8a"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_549459c6d4b363a13163cc8f03"`, undefined);
        await queryRunner.query(`DROP TABLE "offer_fulfillment_options_fulfillment_option"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_bc4a26084b4edb0fbc45a05163"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_75ca2cb2eb7b814786ba55c4f3"`, undefined);
        await queryRunner.query(`DROP TABLE "offer_customer_group_filters_customer_group"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ff1fb17a767cf6b8acbcaa53f2"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_b7ed9499e522895acef5afae21"`, undefined);
        await queryRunner.query(`DROP TABLE "offer_channels_channel"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_3f13cbfa99a53b46cbd129dc38"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_21b1c670c82dcd9dda97d1a69d"`, undefined);
        await queryRunner.query(`DROP TABLE "fulfillment_option_channels_channel"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_c570c1bd300dcb14fde34499f0"`, undefined);
        await queryRunner.query(`DROP TABLE "offer"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_ec49deb165cfdeea5b9668adb5"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_f0c80fd4ce65f33f3e419fa7cb"`, undefined);
        await queryRunner.query(`DROP TABLE "offer_line_item"`, undefined);
        await queryRunner.query(`DROP INDEX "public"."IDX_93628f6f78e752e45f93821d8d"`, undefined);
        await queryRunner.query(`DROP TABLE "fulfillment_option"`, undefined);
   }

}
