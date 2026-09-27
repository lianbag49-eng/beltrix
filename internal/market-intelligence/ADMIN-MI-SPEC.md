# BELTRIX Admin / Market Intelligence Spec

## Dashboard sections

### 1. Venue overview
- current 24h / 7d / 30d volume
- OI
- funding
- fee model
- source freshness
- data-confidence warning

### 2. Liquidity lab
Per market:
- best bid/ask
- spread bps
- depth by bps bucket
- estimated impact by order size
- snapshot timestamp

### 3. BD CRM
- venue / project
- contact
- pipeline stage
- owner
- next action
- commercial terms
- linked docs
- last contact date

### 4. Economics
- user fee
- referral share
- builder/UI fee
- rebate/discount
- projected net revenue by volume cohort
- settlement timing

### 5. White-label
- launch model
- supported chains
- branding control
- custody/signing model
- shared liquidity
- API maturity
- integration effort notes

### 6. Risk / execution admission
Read-only view of every execution-gates.js control.
A failed mandatory gate blocks production routing.

### 7. Change watch
Track changes to:
- fees
- referral programs
- builder terms
- API versions
- supported chains/markets
- product/jurisdiction restrictions
- major outage/security notices

## Access
Internal authenticated admin surface only. Never ship this directory through the public BELTRIX static publish.
