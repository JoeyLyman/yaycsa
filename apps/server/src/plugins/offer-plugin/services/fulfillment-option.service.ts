import { randomUUID } from "node:crypto";
import { Injectable } from "@nestjs/common";
import {
  Channel,
  ChannelService,
  ID,
  ListQueryBuilder,
  ListQueryOptions,
  PaginatedList,
  RequestContext,
  TransactionalConnection,
  UserInputError,
} from "@vendure/core";

import { FulfillmentOption } from "../entities/fulfillment-option.entity";
import { Offer } from "../entities/offer.entity";

export interface CreateFulfillmentOptionInput {
  name: string;
  type: "pickup" | "delivery";
  notes?: string | null;
  recurrence?: string | null;
  fulfillmentStartDate?: Date | null;
  fulfillmentEndDate?: Date | null;
  deadlineOffsetHours?: number | null;
}

export interface UpdateFulfillmentOptionInput {
  id: ID;
  name?: string;
  type?: "pickup" | "delivery";
  notes?: string | null;
  recurrence?: string | null;
  fulfillmentStartDate?: Date | null;
  fulfillmentEndDate?: Date | null;
  deadlineOffsetHours?: number | null;
}

@Injectable()
export class FulfillmentOptionService {
  constructor(
    private connection: TransactionalConnection,
    private listQueryBuilder: ListQueryBuilder,
    private channelService: ChannelService,
  ) {}

  async findAll(
    ctx: RequestContext,
    options?: ListQueryOptions<FulfillmentOption>,
    sellerId?: ID,
    includeDeleted = false,
  ): Promise<PaginatedList<FulfillmentOption>> {
    const requestedSellerId = this.getRequestedSellerId(ctx, sellerId);

    const queryBuilder = this.listQueryBuilder.build(FulfillmentOption, options, {
      ctx,
      channelId: ctx.channelId,
      relations: ["seller"],
    });

    if (requestedSellerId) {
      queryBuilder.andWhere('fulfillmentOption."sellerId" = :sellerId', {
        sellerId: requestedSellerId,
      });
    }

    if (!includeDeleted) {
      queryBuilder.andWhere("fulfillmentOption.deletedAt IS NULL");
    }

    return queryBuilder.getManyAndCount().then(([items, totalItems]) => ({ items, totalItems }));
  }

  async findOne(ctx: RequestContext, id: ID, sellerId?: ID, includeDeleted = false): Promise<FulfillmentOption | null> {
    const requestedSellerId = this.getRequestedSellerId(ctx, sellerId);

    if (requestedSellerId) {
      const option = await this.connection.getRepository(ctx, FulfillmentOption).findOne({
        where: { id, sellerId: requestedSellerId },
        relations: ["seller"],
      });
      if (!option) {
        return null;
      }
      if (!includeDeleted && option.deletedAt) {
        return null;
      }
      return option;
    }

    const result = await this.connection.findOneInChannel(ctx, FulfillmentOption, id, ctx.channelId, {
      relations: ["seller"],
    });
    if (!result) {
      return null;
    }
    if (!includeDeleted && result.deletedAt) {
      return null;
    }
    return result;
  }

  async create(ctx: RequestContext, input: CreateFulfillmentOptionInput, sellerId?: ID): Promise<FulfillmentOption> {
    const requestedSellerId = this.getRequestedSellerId(ctx, sellerId);
    if (!requestedSellerId) {
      throw new UserInputError("Cannot create fulfillment option without a seller context");
    }

    this.validateOptionFields(input);

    const option = new FulfillmentOption({
      code: await this.generateInternalCode(ctx, requestedSellerId),
      name: input.name.trim(),
      type: input.type,
      description: input.notes ?? null,
      sortOrder: 0,
      recurrence: (input.recurrence as FulfillmentOption["recurrence"]) ?? null,
      fulfillmentStartDate: input.fulfillmentStartDate ?? null,
      fulfillmentEndDate: input.fulfillmentEndDate ?? null,
      fulfillmentTimeDescription: null,
      deadlineOffsetHours: input.deadlineOffsetHours ?? null,
      deletedAt: null,
      sellerId: requestedSellerId,
    });

    option.channels = await this.getChannelsForSeller(ctx, requestedSellerId);

    return this.connection.getRepository(ctx, FulfillmentOption).save(option);
  }

  async update(ctx: RequestContext, input: UpdateFulfillmentOptionInput, sellerId?: ID): Promise<FulfillmentOption> {
    const existing = await this.findOne(ctx, input.id, sellerId);
    if (!existing) {
      throw new UserInputError(`FulfillmentOption with id '${input.id as string}' not found`);
    }

    if (input.name !== undefined) existing.name = input.name.trim();
    if (input.type !== undefined) existing.type = input.type;
    if (input.notes !== undefined) existing.description = input.notes ?? null;
    if (input.recurrence !== undefined) existing.recurrence = input.recurrence as FulfillmentOption["recurrence"];
    if (input.fulfillmentStartDate !== undefined) existing.fulfillmentStartDate = input.fulfillmentStartDate;
    if (input.fulfillmentEndDate !== undefined) existing.fulfillmentEndDate = input.fulfillmentEndDate;
    if (input.deadlineOffsetHours !== undefined) existing.deadlineOffsetHours = input.deadlineOffsetHours;
    existing.sortOrder = 0;
    existing.fulfillmentTimeDescription = null;

    this.validateOptionFields(existing);

    return this.connection.getRepository(ctx, FulfillmentOption).save(existing);
  }

  async delete(
    ctx: RequestContext,
    id: ID,
    sellerId?: ID,
    permanently = false,
  ): Promise<{ result: "DELETED" | "NOT_DELETED"; message?: string }> {
    const existing = await this.findOne(ctx, id, sellerId, true);
    if (!existing) {
      return { result: "NOT_DELETED", message: `FulfillmentOption with id '${id as string}' not found` };
    }

    const usageSummary = await this.getOfferUsageSummary(ctx, existing.id, existing.sellerId);
    const hasOfferReferences = usageSummary.totalOfferCount > 0;

    if (permanently) {
      if (hasOfferReferences) {
        return {
          result: "NOT_DELETED",
          message:
            "This fulfillment option is still referenced by one or more non-deleted offers. Delete or remove those offer references first.",
        };
      }
      await this.connection.getRepository(ctx, FulfillmentOption).remove(existing);
      return { result: "DELETED" };
    }

    if (!hasOfferReferences) {
      await this.connection.getRepository(ctx, FulfillmentOption).remove(existing);
      return { result: "DELETED" };
    }

    if (!existing.deletedAt) {
      existing.deletedAt = new Date();
      await this.connection.getRepository(ctx, FulfillmentOption).save(existing);
    }

    return { result: "DELETED" };
  }

  async restore(ctx: RequestContext, id: ID, sellerId?: ID): Promise<FulfillmentOption> {
    const existing = await this.findOne(ctx, id, sellerId, true);
    if (!existing) {
      throw new UserInputError(`FulfillmentOption with id '${id as string}' not found`);
    }

    existing.deletedAt = null;
    return this.connection.getRepository(ctx, FulfillmentOption).save(existing);
  }

  private getRequestedSellerId(ctx: RequestContext, sellerId?: ID): ID | undefined {
    return sellerId ?? ctx.channel.sellerId ?? undefined;
  }

  private async getChannelsForSeller(ctx: RequestContext, sellerId: ID): Promise<Channel[]> {
    const defaultChannel = await this.channelService.getDefaultChannel(ctx);
    const sellerChannel =
      ctx.channel.sellerId === sellerId
        ? ctx.channel
        : await this.connection.getRepository(ctx, Channel).findOne({ where: { sellerId } });

    if (!sellerChannel) {
      throw new UserInputError(`Seller channel for seller '${sellerId as string}' not found`);
    }

    return [sellerChannel, defaultChannel].filter(
      (channel, index, channels) => channels.findIndex((candidate) => candidate.id === channel.id) === index,
    );
  }

  private async assertUniqueCode(ctx: RequestContext, sellerId: ID, code: string, excludeId?: ID): Promise<void> {
    const trimmedCode = code.trim();
    if (trimmedCode.length === 0) {
      throw new UserInputError("Fulfillment option code is required");
    }

    const existing = await this.connection.getRepository(ctx, FulfillmentOption).findOne({
      where: { sellerId, code: trimmedCode },
    });

    if (existing && existing.id !== excludeId) {
      throw new UserInputError(`A fulfillment option with code '${trimmedCode}' already exists`);
    }
  }

  private async generateInternalCode(ctx: RequestContext, sellerId: ID): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const generatedCode = `fo_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
      const existing = await this.connection.getRepository(ctx, FulfillmentOption).findOne({
        where: { sellerId, code: generatedCode },
      });

      if (!existing) {
        return generatedCode;
      }
    }

    throw new UserInputError("Failed to generate a unique fulfillment option identifier");
  }

  private validateOptionFields(option: {
    name: string;
    recurrence?: string | null;
    fulfillmentStartDate?: Date | null;
    fulfillmentEndDate?: Date | null;
    deadlineOffsetHours?: number | null;
  }): void {
    if (option.name.trim().length === 0) {
      throw new UserInputError("Fulfillment option name is required");
    }

    if (option.fulfillmentEndDate && !option.fulfillmentStartDate) {
      throw new UserInputError("Fulfillment end date requires a fulfillment start date");
    }

    if (
      option.fulfillmentStartDate &&
      option.fulfillmentEndDate &&
      option.fulfillmentEndDate < option.fulfillmentStartDate
    ) {
      throw new UserInputError("Fulfillment end date must be after the start date");
    }

    if (option.recurrence && !option.fulfillmentStartDate) {
      throw new UserInputError("Recurrence requires a fulfillment start date");
    }

    if (option.deadlineOffsetHours != null && option.deadlineOffsetHours < 0) {
      throw new UserInputError("Deadline offset hours cannot be negative");
    }
  }

  private async getOfferUsageSummary(
    ctx: RequestContext,
    fulfillmentOptionId: ID,
    sellerId?: ID,
  ): Promise<{ totalOfferCount: number; activeOfferCount: number }> {
    const baseQuery = this.connection
      .getRepository(ctx, Offer)
      .createQueryBuilder("offer")
      .innerJoin("offer.fulfillmentOptions", "fulfillmentOption", "fulfillmentOption.id = :fulfillmentOptionId", {
        fulfillmentOptionId,
      });

    if (sellerId) {
      baseQuery.andWhere('offer."sellerId" = :sellerId', { sellerId });
    }

    const totalOfferCount = await baseQuery.clone().getCount();
    const activeOfferCount = await baseQuery
      .clone()
      .andWhere("offer.status = :status", { status: "active" })
      .getCount();

    return { totalOfferCount, activeOfferCount };
  }
}
