# business type...

- no, everyone is every business type
- they are a reseller if they are reselling things, a seller if they are selling this, a restaurant if they are selling ready to eat food, etc. this is not a selection they make ahead of time, and shouldnt be hardcoded. everyone should be able to use their same account for buying and selling.

# offers price

- give claude an example of pricing, like $4 / ct, 24$ / 24ct.. etc
- each line item can have a price rule, or seller can override each prices and case size.
  - like, could select 10% off for case tiers or set specific price. its like a spreadsheet so can select all
    as well.
- need to be able to add and subtract case sizes
- seller can make case sizes explicit or for tiered pricing (like we do)

# product custom fields

- dont need those yet... growing season, storagetype, dont know why those are in the plan

# seller channels

- make sure that each seller can have multiple channels too and that this feature does not disappear by
  using channels to make the app multi-vendor

# customer groups

- make sure that each seller can make their own customer groups

# entity: offer

- change quantityAvailable to quantityAvailableMax to make the 'null' more intuitive (unlimited)
- not sure i like the quantity ordered line... cant we just get this info from summing all the orders?
- inventorybasis.... shouldnt be per offer... should be per offer line item...
- maybe needs fulfillmentOptions too? to be able to filter fulfillment options
- freshsheet and freshsheetid... what are freshsheets if offer isnt the fresh sheet?

# fresh sheet...

- is this what i want? do i need to have this entity at all? why not just multiple offers?
