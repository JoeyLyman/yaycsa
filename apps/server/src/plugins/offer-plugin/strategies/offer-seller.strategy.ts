import {
    Channel,
    ChannelService,
    EntityHydrator,
    ID,
    idsAreEqual,
    Injector,
    Order,
    OrderLine,
    OrderSellerStrategy,
    OrderState,
    RequestContext,
    ShippingLine,
    TransactionalConnection,
} from '@vendure/core';

import { Offer } from '../entities/offer.entity';
import { OfferLineItem } from '../entities/offer-line-item.entity';

/**
 * Assigns each OrderLine to the correct seller channel based on the
 * ProductVariant's channel assignments, and splits orders by seller at checkout.
 */
export class OfferOrderSellerStrategy implements OrderSellerStrategy {
    private channelService: ChannelService;
    private entityHydrator: EntityHydrator;
    private connection: TransactionalConnection;

    init(injector: Injector) {
        this.channelService = injector.get(ChannelService);
        this.entityHydrator = injector.get(EntityHydrator);
        this.connection = injector.get(TransactionalConnection);
    }

    /**
     * Called whenever a new OrderLine is added. Returns the seller's channel
     * so Vendure can set orderLine.sellerChannelId.
     */
    async setOrderLineSellerChannel(
        ctx: RequestContext,
        orderLine: OrderLine,
    ): Promise<Channel | undefined> {
        await this.entityHydrator.hydrate(ctx, orderLine.productVariant, {
            relations: ['channels'],
        });
        const defaultChannel = await this.channelService.getDefaultChannel();

        // Find the non-default channel (seller's channel)
        const sellerChannel = orderLine.productVariant.channels.find(
            c => !idsAreEqual(c.id, defaultChannel.id),
        );
        return sellerChannel;
    }

    /**
     * At checkout, split the aggregate order into seller sub-orders.
     * Groups OrderLines by sellerChannelId.
     */
    async splitOrder(ctx: RequestContext, order: Order) {
        const channelGroups = new Map<string, OrderLine[]>();

        for (const line of order.lines) {
            const channelId = line.sellerChannelId ? String(line.sellerChannelId) : '__default__';
            if (!channelGroups.has(channelId)) {
                channelGroups.set(channelId, []);
            }
            channelGroups.get(channelId)!.push(line);
        }

        return Array.from(channelGroups.entries()).map(([channelId, lines]) => ({
            channelId: (channelId === '__default__' ? ctx.channelId : channelId) as ID,
            state: order.state as OrderState,
            lines,
            shippingLines: order.shippingLines,
        }));
    }

    /**
     * After seller orders are created, set the offer and fulfillmentOption
     * custom fields on each seller order from the order lines.
     */
    async afterSellerOrdersCreated(
        ctx: RequestContext,
        aggregateOrder: Order,
        sellerOrders: Order[],
    ): Promise<void> {
        for (const sellerOrder of sellerOrders) {
            // Get the offerId from the first order line's offerLineItem
            const firstLine = sellerOrder.lines[0];
            if (!firstLine) continue;

            const offerLineItemId = (firstLine.customFields as any)?.offerLineItem?.id;
            if (!offerLineItemId) continue;

            const offerLineItem = await this.connection
                .getRepository(ctx, OfferLineItem)
                .findOne({ where: { id: offerLineItemId } });
            if (!offerLineItem) continue;

            const offer = await this.connection
                .getRepository(ctx, Offer)
                .findOne({ where: { id: offerLineItem.offerId } });
            if (!offer) continue;

            // Set offer custom field on the seller order
            await this.connection.rawConnection.query(
                `UPDATE "order" SET "customFieldsOfferid" = $1 WHERE id = $2`,
                [offer.id, sellerOrder.id],
            );
        }
    }
}
