import { Injectable } from '@nestjs/common';
import {
    ChannelService,
    ID,
    ListQueryBuilder,
    ListQueryOptions,
    PaginatedList,
    RequestContext,
    TransactionalConnection,
    UserInputError,
} from '@vendure/core';

import { FulfillmentOption } from '../entities/fulfillment-option.entity';

export interface CreateFulfillmentOptionInput {
    code: string;
    name: string;
    type: 'pickup' | 'delivery';
    description?: string | null;
    active?: boolean;
    sortOrder?: number;
    recurrence?: string | null;
    fulfillmentStartDate?: Date | null;
    fulfillmentEndDate?: Date | null;
    fulfillmentTimeDescription?: string | null;
    deadlineOffsetHours?: number | null;
}

export interface UpdateFulfillmentOptionInput {
    id: ID;
    code?: string;
    name?: string;
    type?: 'pickup' | 'delivery';
    description?: string | null;
    active?: boolean;
    sortOrder?: number;
    recurrence?: string | null;
    fulfillmentStartDate?: Date | null;
    fulfillmentEndDate?: Date | null;
    fulfillmentTimeDescription?: string | null;
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
    ): Promise<PaginatedList<FulfillmentOption>> {
        return this.listQueryBuilder
            .build(FulfillmentOption, options, {
                ctx,
                channelId: ctx.channelId,
                relations: ['seller'],
            })
            .getManyAndCount()
            .then(([items, totalItems]) => ({ items, totalItems }));
    }

    async findOne(ctx: RequestContext, id: ID): Promise<FulfillmentOption | null> {
        const result = await this.connection.findOneInChannel(ctx, FulfillmentOption, id, ctx.channelId, {
            relations: ['seller'],
        });
        return result ?? null;
    }

    async create(ctx: RequestContext, input: CreateFulfillmentOptionInput): Promise<FulfillmentOption> {
        const sellerId = ctx.channel.sellerId;
        if (!sellerId) {
            throw new UserInputError('Cannot create fulfillment option without a seller channel');
        }
        const option = new FulfillmentOption({
            code: input.code,
            name: input.name,
            type: input.type,
            description: input.description ?? null,
            active: input.active ?? true,
            sortOrder: input.sortOrder ?? 0,
            recurrence: (input.recurrence as FulfillmentOption['recurrence']) ?? null,
            fulfillmentStartDate: input.fulfillmentStartDate ?? null,
            fulfillmentEndDate: input.fulfillmentEndDate ?? null,
            fulfillmentTimeDescription: input.fulfillmentTimeDescription ?? null,
            deadlineOffsetHours: input.deadlineOffsetHours ?? null,
            sellerId,
        });
        // Assign to seller's channel + default channel
        const sellerChannel = ctx.channel;
        const defaultChannel = await this.channelService.getDefaultChannel(ctx);
        option.channels = [sellerChannel, defaultChannel];

        return this.connection.getRepository(ctx, FulfillmentOption).save(option);
    }

    async update(ctx: RequestContext, input: UpdateFulfillmentOptionInput): Promise<FulfillmentOption> {
        const existing = await this.findOne(ctx, input.id);
        if (!existing) {
            throw new UserInputError(`FulfillmentOption with id '${input.id as string}' not found`);
        }
        if (input.code !== undefined) existing.code = input.code;
        if (input.name !== undefined) existing.name = input.name;
        if (input.type !== undefined) existing.type = input.type;
        if (input.description !== undefined) existing.description = input.description;
        if (input.active !== undefined) existing.active = input.active;
        if (input.sortOrder !== undefined) existing.sortOrder = input.sortOrder;
        if (input.recurrence !== undefined) existing.recurrence = input.recurrence as FulfillmentOption['recurrence'];
        if (input.fulfillmentStartDate !== undefined) existing.fulfillmentStartDate = input.fulfillmentStartDate;
        if (input.fulfillmentEndDate !== undefined) existing.fulfillmentEndDate = input.fulfillmentEndDate;
        if (input.fulfillmentTimeDescription !== undefined) existing.fulfillmentTimeDescription = input.fulfillmentTimeDescription;
        if (input.deadlineOffsetHours !== undefined) existing.deadlineOffsetHours = input.deadlineOffsetHours;

        return this.connection.getRepository(ctx, FulfillmentOption).save(existing);
    }

    async delete(ctx: RequestContext, id: ID): Promise<{ result: 'DELETED' | 'NOT_DELETED'; message?: string }> {
        const existing = await this.findOne(ctx, id);
        if (!existing) {
            return { result: 'NOT_DELETED', message: `FulfillmentOption with id '${id as string}' not found` };
        }
        await this.connection.getRepository(ctx, FulfillmentOption).remove(existing);
        return { result: 'DELETED' };
    }
}
