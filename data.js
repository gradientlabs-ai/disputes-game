// Dispute Factory v1 static content: case types, teams, handbook, escalation scenarios, difficulties, policies.
(function (root) {
  'use strict';

  // Case types. col is the v1 palette colour for the case block: orange ordinary, coral regulated, gold complaint.
  const ORANGE = '#FF8933', CORAL = '#F27C71', GOLD = '#FFED77';
  const TYPES = {
    RECOG:  { name: "Don't recognise",  regulated: false, col: ORANGE, sla: 3,   era: 1, blurb: "Customer doesn't recognise a payment. Often it's them, family, or a cryptic merchant name. Triage can resolve it." },
    FRAUD:  { name: 'Unauthorised',     regulated: true,  col: CORAL,  sla: 1.6, era: 1, blurb: 'Someone else used the card. Refund by the end of the next business day, then try to recover the money.' },
    GNR:    { name: 'Not received',     regulated: false, col: ORANGE, sla: 8,   era: 1, blurb: 'Paid, but nothing arrived (or not as described). A chargeback candidate after the merchant is contacted.' },
    DUP:    { name: 'Duplicate charge', regulated: false, col: ORANGE, sla: 8,   era: 1, blurb: 'Charged twice for the same thing. Usually clear-cut.' },
    SUB:    { name: 'Cancelled subscription', regulated: false, col: ORANGE, sla: 8, era: 1, blurb: 'Still billed after cancelling a subscription. Needs proof of cancellation.' },
    FRIEND: { name: 'Friendly fraud',   regulated: false, col: ORANGE, sla: 8,   era: 1, blurb: 'Customer made the purchase but disputes it anyway. Usually declined.' },
    LATE:   { name: 'Out of time',      regulated: false, col: ORANGE, sla: 3,   era: 1, blurb: 'Past the chargeback window (about 120 days). Declined.' },
    APP:    { name: 'APP scam',         regulated: true,  col: CORAL,  sla: 4.5, era: 2, blurb: 'Tricked into sending a bank transfer to a scammer. Reimburse within 5 business days. No chargeback exists for this.' },
    DD:     { name: 'Direct Debit',     regulated: true,  col: CORAL,  sla: 1.6, era: 2, blurb: 'Direct Debit taken wrongly by a company. Refund at once under the Direct Debit Guarantee.' },
    ACQ:    { name: 'Acquiring chargeback', regulated: false, col: ORANGE, sla: 8, era: 3, blurb: "Another bank's customer disputes a purchase at one of your merchants. Chase evidence, then fight or accept." },
    COMP:   { name: 'Complaint',        regulated: false, col: GOLD,   sla: 4,   era: 1, blurb: 'A complaint, usually caused by delays or declines. The clock runs. Left to rot it ends at the Ombudsman.' },
  };

  // Teams. kind: 'work' (staffed flow station), 'policy' (staffed, not in the case flow: Merchant risk), 'ext' (not staffable).
  // short: max 6 chars, for narrow wells. blurb: one line. desc: longer text. upgrade: name of the single upgrade.
  const STATIONS = {
    INTAKE: { name: 'Intake', short: 'Intake', team: 'Contact centre', era: 1, kind: 'work', rate: 9, outsource: true,
      blurb: 'Logs every new claim. Missing details cause rework later.',
      desc: 'First contact. Agents log the claim, the transaction and what the customer already tried with the merchant. Missing details bounce back later and cost days.',
      upgrade: 'Smart claim forms and receipt capture' },
    TRIAGE: { name: 'Triage', short: 'Triage', team: 'Disputes', era: 1, kind: 'work', rate: 12, outsource: true,
      blurb: "Routes claims. Many don't-recognise calls end here.",
      desc: "Routes the claim. 'Don't recognise' queries often end here, out-of-time claims are declined, fraud goes to Fraud ops, scams and Direct Debits go to Payments ops.",
      upgrade: 'Merchant lookup and auto-triage' },
    FRAUD: { name: 'Fraud ops', short: 'Fraud', team: 'Financial crime', era: 1, kind: 'work', rate: 6,
      blurb: 'Refunds unauthorised payments by the next business day.',
      desc: 'Blocks the card and refunds unauthorised payments by the end of the next business day (PSRs 2017). Suspected first-party fraud is declined instead.',
      upgrade: 'Device signals and fraud scoring' },
    PAYOPS: { name: 'Payments ops', short: 'Paymts', team: 'Payments', era: 2, kind: 'work', rate: 5,
      blurb: 'APP scams (5 day deadline) and Direct Debit refunds.',
      desc: 'Faster Payments and Direct Debit claims. APP scams must be reimbursed within 5 business days (cost split 50:50 with the receiving bank). Direct Debit errors are refunded at once.',
      upgrade: 'Payee-bank messaging and recall tooling' },
    EVID: { name: 'Review', short: 'Review', team: 'Disputes', era: 1, kind: 'work', rate: 4.2, outsource: true,
      blurb: 'Checks evidence, contacts merchants, decides on chargebacks.',
      desc: 'Analysts check the reason code, time limit and 3-D Secure, then contact the merchant. Outcomes: the merchant refunds, the claim is declined, or a chargeback is prepared. In easy, merchant representments come back here too.',
      upgrade: 'Evidence pack builder' },
    SPONSOR: { name: 'Sponsor bank', short: 'Sponsr', team: 'Partner bank', era: 1, kind: 'ext', rate: 0,
      blurb: 'Partner bank files chargebacks for you. Capped, slow, £11 a case.',
      desc: 'Your sponsor bank holds the scheme membership and files every chargeback for you. It has a daily throughput cap, adds a day of latency and charges a fee per case. Buy a faster tier to raise the cap.' },
    SCHEME: { name: 'Scheme ops', short: 'Scheme', team: 'Disputes', era: 2, kind: 'work', rate: 8,
      blurb: 'Your own team files chargebacks in the card scheme.',
      desc: 'You are a principal member. Your team files chargebacks directly in the scheme systems (Visa Resolve Online, Mastercom) for a small per-case scheme fee.',
      upgrade: 'Scheme API filing' },
    MERCH: { name: 'Merchant response', short: 'Merch', team: 'Scheme and acquirer', era: 1, kind: 'ext', rate: 0,
      blurb: 'The merchant and its bank respond. Not yours to staff.',
      desc: "Out of your hands. The merchant's bank forwards the chargeback and the merchant accepts, stays silent, or fights back with a representment. Real deadlines are about 30 days; here they are compressed." },
    REPR: { name: 'Representment desk', short: 'Repres', team: 'Disputes', era: 2, kind: 'work', rate: 4.5,
      blurb: 'Reviews merchant counter-evidence. Accept the loss or escalate.',
      desc: 'Reviews merchant evidence. Strong evidence: accept the loss. Weak: go to pre-arbitration. Lose in arbitration and you pay the scheme fee (about £450).',
      upgrade: 'Evidence matching and win-rate analytics' },
    COMPL: { name: 'Complaints', short: 'Compl', team: 'Customer care', era: 1, kind: 'work', rate: 4, outsource: true,
      blurb: 'Handles complaints. Late ones cost Ombudsman fees.',
      desc: 'Unhappy customers complain about delays and declines. Final responses are time-boxed, and unresolved complaints can reach the Financial Ombudsman Service, which charges the firm a case fee.',
      upgrade: 'Final-response drafter' },
    ACQIN: { name: 'Acquiring intake', short: 'AcqIn', team: 'Acquiring', era: 3, kind: 'work', rate: 9,
      blurb: 'Logs chargebacks hitting your merchants.',
      desc: 'You are an acquirer too. Incoming chargebacks from other issuers land here to be validated and logged against the merchant.',
      upgrade: 'Scheme file ingestion' },
    MEVID: { name: 'Merchant evidence', short: 'MEvid', team: 'Acquiring', era: 3, kind: 'work', rate: 4,
      blurb: 'Chases merchants for proof of delivery.',
      desc: 'Chases merchants for proof of delivery, authentication and prior orders. No usable evidence means the chargeback is accepted and the merchant is debited.',
      upgrade: 'Merchant evidence portal' },
    REPSUB: { name: 'Representment filing', short: 'RepOut', team: 'Acquiring', era: 3, kind: 'work', rate: 6,
      blurb: "Files the merchant's fight-back before the deadline.",
      desc: 'Files the second presentment back to the scheme before the deadline lapses. Late means automatic loss.',
      upgrade: 'Auto-filing rules' },
    ACQW: { name: 'Issuer review', short: 'Issuer', team: 'Scheme and issuer', era: 3, kind: 'ext', rate: 0,
      blurb: 'The issuer decides. Not yours to staff.',
      desc: 'The issuer reviews your representment. Win and the merchant keeps the money. Lose and the merchant is debited, and if the merchant has collapsed you carry the loss.' },
    RISK: { name: 'Merchant risk', short: 'Risk', team: 'Acquiring', era: 3, kind: 'policy', rate: 1,
      blurb: 'Watches merchant ratios. Prevents fines and big losses.',
      desc: 'Monitors merchant chargeback ratios, sets rolling reserves and chases remediation. Fewer chargebacks come in, losses shrink when a merchant fails, and scheme fines are avoided. About 3 agents give full cover (2 with the upgrade).',
      upgrade: 'Early-warning model' },
  };

  const HANDBOOK = {
    chargeback: ['A chargeback is not the law', "A chargeback is a card-scheme rule (Visa, Mastercard), not a legal right. Each reason code has its own evidence rules, and the usual window is 120 days from the transaction or expected delivery. Late means lost."],
    s75: ['Section 75', 'On credit card purchases between £100 and £30,000 (per item) the card issuer is jointly liable with the merchant for breach of contract or misrepresentation (Consumer Credit Act 1974). It is a legal right and works even when the chargeback window has closed. Debit cards do not get it.'],
    psr_unauth: ['Unauthorised payments', 'Under the Payment Services Regulations 2017 you must refund an unauthorised payment by the end of the next business day. The exceptions: reasonable grounds to suspect fraud by the customer (you notify the authorities) or gross negligence. If the customer denies authorising, the firm must show the payment was authenticated. Refund first, recover later.'],
    threeds: ['3-D Secure liability shift', "If a card payment was authenticated with 3-D Secure, liability for fraud shifts to the issuer, and fraud chargebacks are normally blocked. So the issuer's fraud losses often stay with the issuer."],
    lifecycle: ['The chargeback lifecycle', 'Dispute, issuer checks, first chargeback, then the merchant accepts, stays silent, or represents (second presentment). Then pre-arbitration, then scheme arbitration. The loser typically pays a fee of several hundred pounds, so weak cases should not be escalated.'],
    prearb: ['Pre-arbitration', 'After a representment the issuer can accept it or escalate to pre-arbitration. Escalating with weak evidence just burns scheme fees. Strong evidence either way decides it.'],
    notall: ['Not every dispute is a chargeback', "Many disputes end earlier: the customer recognises the purchase after seeing the details, the merchant refunds once contacted, the claim is out of time, it is friendly fraud, evidence is thin, or the amount is too small to justify the fees."],
    friendly: ['Friendly fraud', "First-party misuse: the customer, or someone they let use the card, made or received the purchase but disputes it. Payments made with the customer's consent are authorised, so the unauthorised-payment rules don't apply."],
    reasoncode: ['Reason codes', 'Use the wrong one and the chargeback fails. Visa examples: 10.4 card-absent fraud, 13.1 services not provided, 13.2 cancelled recurring, 13.3 not as described. Mastercard: 4837 no cardholder authorisation, 4853 cardholder dispute, 4855 goods or services not provided.'],
    sponsor: ['Sponsor banks', "Many fintechs and EMIs issue cards under a BIN sponsored by a principal scheme member. The sponsor touches the scheme systems, adds latency and charges per case. You are limited by its throughput."],
    issuer: ['Being the issuer', 'A principal member files chargebacks directly (Visa Resolve Online, Mastercom), owns scheme compliance and bears the losses. Interchange (capped in the UK at 0.2% for consumer debit and 0.3% for consumer credit) is what pays for all of this.'],
    app: ['APP scam reimbursement', 'Since 7 October 2024 the Payment Systems Regulator requires Faster Payments and CHAPS APP scam victims to be reimbursed (up to £85,000) within 5 business days, with the clock able to stop for information. The cost is split 50:50 between sending and receiving firms. Claims can be made for 13 months. It is a bank transfer, so there is no chargeback.'],
    dd: ['The Direct Debit Guarantee', 'If the originator or the bank makes an error, the customer gets an immediate refund from their bank, which then recovers it from the originator. No card-scheme rules are involved.'],
    fos: ['Complaints and the Ombudsman', 'Firms have 8 weeks for a final response, or 15 business days for payment-services complaints such as unauthorised transactions (35 in exceptional cases). After that the customer can go to the Financial Ombudsman Service, and the firm pays a case fee of several hundred pounds beyond a small free allowance.'],
    acquirer: ['Being the acquirer', "You settle the merchants. Incoming chargebacks hit the merchant's balance, and if the merchant collapses (think airline) the acquirer carries the loss. Hence underwriting, rolling reserves and monitoring."],
    ratio: ['Chargeback ratios', 'Schemes run monitoring programmes (Visa VAMP, Mastercard ECM) for merchants with excessive dispute or fraud ratios, with thresholds of roughly 1% to 1.5% and minimum volumes. Acquirers face fines and remediation plans.'],
    rdr: ['Pre-dispute tools', 'Visa RDR and Ethoca or Verifi alerts let merchants refund automatically before a chargeback lands. For small amounts this is usually cheaper than fighting.'],
    ce3: ['Compelling Evidence 3.0', 'Visa CE 3.0 lets merchants defeat fraud chargebacks (10.4) by linking earlier undisputed transactions with the same device, IP address or ID to the disputed one.'],
  };

  const CLINIC = [
    {
      id: 'descriptor', era: 1, hb: ['notall'],
      title: "Who is XCLDGAMES?",
      text: "A customer calls: \"I don't recognise a £7.99 payment to PAYPAL *XCLDGAMES.\" The payment was made with Apple Pay on the customer's own phone.",
      opts: [
        { t: 'Raise a fraud chargeback straight away', ok: false, why: "Hold on. Wallet payments are tied to the customer's device, and a cryptic descriptor often hides a real purchase (a game, a family member's app). Disputing it wastes fees." },
        { t: 'Share the merchant details and check family and subscriptions first', ok: true, why: "Right. A large share of 'don't recognise' contacts end here when the customer realises it was them or a family member. Details before disputes is cheap." },
        { t: 'Refund £7.99 and close it', ok: false, why: "Goodwill refunds are allowed but burn margin, teach customers to skip the checking step, and have no recovery route." },
      ],
    },
    {
      id: 'threeds', era: 1, hb: ['psr_unauth', 'threeds'],
      title: 'The 3-D Secure paradox',
      text: "A customer says a £1,200 online payment wasn't theirs. The card never left their wallet. Our logs show it passed 3-D Secure with a code sent to their phone. The clock is ticking.",
      opts: [
        { t: 'Refuse: it passed 3-D Secure so they must have authorised it', ok: false, why: "Not safe. A 3-D Secure pass is evidence, not proof (SIM swaps and phone takeovers produce valid codes), and the PSRs 2017 require a refund by the end of the next business day unless you have reasonable grounds to suspect customer fraud." },
        { t: 'Refund by end of next business day, then investigate (expect no chargeback, liability shifted to us)', ok: true, why: "Yes. Refund first, recover later. Because the payment was authenticated, the liability shift means a fraud chargeback is normally blocked, so the loss may stay with the issuer." },
        { t: 'Raise a chargeback and wait for the merchant', ok: false, why: "The PSRs clock doesn't wait for the scheme, and with 3-D Secure the chargeback would likely be rejected anyway." },
      ],
    },
    {
      id: 'suspect', era: 1, hb: ['psr_unauth'],
      title: 'Smells like fraud',
      text: "A customer reports an unauthorised £300 payment. Your fraud analyst has a hunch it's first-party fraud but has no firm evidence.",
      opts: [
        { t: 'Refuse the refund on the analyst\'s hunch', ok: false, why: "A hunch is not enough. If the customer denies authorising a payment, the firm has to show it was authenticated and, for any negligence argument, prove it." },
        { t: 'Refund by next business day unless you have reasonable grounds to suspect fraud by the customer (then report it), and keep investigating', ok: true, why: "Correct. Reasonable grounds can justify delay, but only with a genuine basis and a report to the authorities. Otherwise, refund and investigate." },
        { t: 'Ask the customer to prove it was not them', ok: false, why: "The burden does not sit with the customer for an unauthorised payment claim." },
      ],
    },
    {
      id: 's75', era: 1, hb: ['s75', 'chargeback'],
      title: 'Sofa, so bad',
      text: "A customer paid £450 on their credit card for a sofa. The retailer went bust before delivery. They ask: \"Is there anything stronger than a chargeback?\"",
      opts: [
        { t: 'No, chargeback is the only route', ok: false, why: "There is a stronger one, and it's a legal right rather than a scheme rule." },
        { t: 'Yes: Section 75 of the Consumer Credit Act makes us jointly liable with the retailer', ok: true, why: "Correct. For credit card purchases between £100 and £30,000 per item, we are jointly liable for breach of contract or misrepresentation. Debit cards don't get Section 75." },
        { t: 'Tell them to claim from the administrator', ok: false, why: "Unsecured creditors in an insolvency recover little. Card protections exist exactly for this." },
      ],
    },
    {
      id: 'sub', era: 1, hb: ['reasoncode'],
      title: "The gym that won't let go",
      text: "Customer: \"I cancelled my £35 a month gym membership two months ago but they keep charging me.\" The gym says it has no record of a cancellation.",
      opts: [
        { t: 'Chargeback immediately, no questions', ok: false, why: "Without proof of cancellation you'll likely lose at representment. Evidence quality decides these." },
        { t: "Ask for proof of cancellation and of contacting the merchant, then file 'cancelled recurring' (Visa 13.2). Remind them they can also cancel the continuous payment authority with us", ok: true, why: "Right. The reason code and evidence decide the outcome, and customers can cancel a continuous payment authority by telling their bank." },
        { t: "Decline: it's between them and the gym", ok: false, why: "A cancelled recurring payment is a valid chargeback reason when there's proof." },
      ],
    },
    {
      id: 'reasoncode', era: 1, hb: ['reasoncode'],
      title: 'Broken headphones',
      text: 'A customer says the headphones that arrived are damaged and the seller ignores them. Which reason do you file under?',
      opts: [
        { t: 'Unauthorised transaction (fraud)', ok: false, why: 'The customer made this purchase, so a fraud code is wrong, and the wrong reason code is a classic way to lose a chargeback.' },
        { t: 'Defective or not as described (Visa 13.3, Mastercard 4853), with photos and proof they tried to return it', ok: true, why: 'Yes. Match the code to what actually happened and attach the evidence the code asks for.' },
        { t: 'Duplicate processing', ok: false, why: 'Nothing was charged twice. The scheme will reject the wrong claim.' },
      ],
    },
    {
      id: 'late', era: 1, hb: ['chargeback'],
      title: 'Out of time',
      text: "A customer disputes an £80 online order delivered 150 days ago, saying it's faulty. They're upset the usual window is 120 days.",
      opts: [
        { t: "File anyway, maybe the merchant won't notice", ok: false, why: 'Scheme systems check dates automatically. It will be rejected and may cost a fee.' },
        { t: 'Decline the chargeback as out of time, explain, and signpost the merchant\'s returns policy and the Consumer Rights Act 2015', ok: true, why: 'Right. Time limits are real. Honest explanation and signposting beats a doomed filing. (Section 75 would only help on a credit card purchase of £100 or more.)' },
        { t: 'Refund from our own pocket', ok: false, why: "Goodwill is your call but isn't a sustainable default. Every late claim would cost margin." },
      ],
    },
    {
      id: 'family', era: 1, hb: ['friendly'],
      title: 'The taxi teen',
      text: "A customer says they didn't authorise a £48 taxi payment. On the phone it emerges their 17-year-old used the card with their agreement.",
      opts: [
        { t: 'Refund by next business day under the unauthorised-payment rules', ok: false, why: "Payments made with the cardholder's consent, including letting someone use the card, are authorised. The unauthorised-payment refund rules don't apply. Goodwill is optional." },
        { t: 'Treat it as authorised, explain why, and offer controls or a teen account', ok: true, why: "Yes. Fact-find first. If consent was given, it isn't an unauthorised payment, and a fraud chargeback would be misdescribed." },
        { t: 'File a fraud chargeback', ok: false, why: "A fraud reason code asserts no authorisation. A misdescribed claim gets defeated and can damage the customer's standing." },
      ],
    },
    {
      id: 'airline', era: 1, hb: ['chargeback', 'acquirer'],
      title: 'Airline down',
      text: 'A mid-sized airline has just gone into administration. Hundreds of customers who paid £600 fares on debit cards are calling.',
      opts: [
        { t: 'Tell customers to wait for the administrator', ok: false, why: 'Unsecured creditors recover little and slowly. The card scheme gives faster routes.' },
        { t: "Raise 'services not provided' chargebacks (Visa 13.1) at volume, with the collapse as evidence", ok: true, why: 'Yes. The window runs from the expected service date. Volumes spike, so staff and templates matter. For the acquirer, a bankrupt merchant means the acquirer carries the loss.' },
        { t: 'Refuse: the merchant, not the bank, owes them', ok: false, why: "The merchant owes them, but the scheme's chargeback system exists to move that loss back." },
      ],
    },
    {
      id: 'fos', era: 1, hb: ['fos'],
      title: 'Tick tock complaint',
      text: 'A complaint about a refused refund for an unauthorised payment arrived 12 business days ago. The team is still "investigating".',
      opts: [
        { t: 'Take as long as needed, 8 weeks is the limit', ok: false, why: 'For payment-services complaints, like unauthorised payments, the final response deadline is 15 business days (35 in exceptional circumstances). 8 weeks applies to other complaints.' },
        { t: 'Send the final response within 15 business days', ok: true, why: 'Correct. Miss it and the customer can take the complaint to the Financial Ombudsman Service, which charges the firm a case fee.' },
        { t: 'Wait for the customer to chase', ok: false, why: "Deadlines run regardless, and silence feeds ombudsman referrals." },
      ],
    },
    {
      id: 'repr', era: 2, hb: ['lifecycle', 'prearb'],
      title: 'The merchant fights back',
      text: "The merchant answers your chargeback with signed proof of delivery to the cardholder's address, a matching 3-D Secure authentication, and two earlier undisputed orders. Pre-arbitration costs about £450 if you lose.",
      opts: [
        { t: 'Always go to pre-arbitration, you never know', ok: false, why: 'Scheme fees add up and a weak case loses. Escalate only when your evidence beats theirs.' },
        { t: "Accept the loss. The evidence is strong, so don't pay to lose twice", ok: true, why: 'Yes. Representment review is mostly economics. Only escalate when your evidence beats theirs.' },
        { t: 'Ignore it', ok: false, why: 'Pre-arbitration windows are short and the case would lapse in the merchant\'s favour with the customer left waiting.' },
      ],
    },
    {
      id: 'app', era: 2, hb: ['app'],
      title: 'The safe account',
      text: "A customer was tricked into sending £4,000 by Faster Payments to a 'safe account'. They ask you to raise a card chargeback.",
      opts: [
        { t: 'Raise a Visa chargeback', ok: false, why: "It wasn't a card payment. Chargebacks only exist for card transactions." },
        { t: 'Assess it under the PSR APP reimbursement rules: decide and reimburse within 5 business days, split 50:50 with the receiving firm', ok: true, why: 'Correct. Since 7 October 2024 reimbursement is mandatory for Faster Payments and CHAPS APP scams up to £85,000. The clock can stop for information. Claims run for 13 months.' },
        { t: "Faster Payments are irrevocable, there's nothing we can do", ok: false, why: 'That used to be the typical answer. Not any more.' },
      ],
    },
    {
      id: 'dd', era: 2, hb: ['dd'],
      title: 'The wrong bill',
      text: 'An energy supplier took £220 by Direct Debit instead of £120 because of their billing error. The customer asks for the money back.',
      opts: [
        { t: 'Ask them to wait for a chargeback', ok: false, why: "Direct Debits aren't card payments, so there are no chargebacks." },
        { t: 'Refund immediately under the Direct Debit Guarantee, then recover from the supplier', ok: true, why: "Correct. Where there is an error by the originator or the bank, the customer gets an immediate refund and the bank recovers from the originator." },
        { t: 'Tell them to complain to the supplier first', ok: false, why: 'They may, but the guarantee entitles them to an immediate refund from their bank.' },
      ],
    },
    {
      id: 'ratio', era: 3, hb: ['ratio', 'acquirer'],
      title: 'Ratio watch',
      text: "StreamBox TV's chargeback ratio has hit 1.4% and is climbing. You are their acquirer.",
      opts: [
        { t: 'Do nothing until the scheme writes to you', ok: false, why: 'Scheme monitoring programmes start with fines and remediation plans for acquirers once merchants cross thresholds (roughly 1% to 1.5% with minimum volumes).' },
        { t: 'Put them on enhanced monitoring: rolling reserve, remediation plan, tighter limits', ok: true, why: 'Yes. Reserves cover losses if the merchant fails, and a remediation plan shows the scheme you are acting.' },
        { t: 'Terminate them instantly and keep the cash', ok: false, why: 'Termination can be right in extremis, but settlement, reserve release and contract terms still need handling, and abrupt cuts can accelerate failure.' },
      ],
    },
    {
      id: 'rdr', era: 3, hb: ['rdr'],
      title: 'Fourteen quid',
      text: 'A £14 chargeback arrives against one of your merchants. Fighting it costs about £30 in staff time and fees.',
      opts: [
        { t: 'Always fight, on principle', ok: false, why: "Economics matter. Contesting costs more than the disputed amount." },
        { t: 'Use pre-dispute tools: auto-refund small amounts via RDR or Ethoca alert rules', ok: true, why: 'Yes. Pre-dispute tools stop the case becoming a chargeback and cut costs, and they keep ratios down.' },
        { t: 'Ignore it', ok: false, why: 'Ignored chargebacks are lost by default and still count towards the merchant ratio.' },
      ],
    },
    {
      id: 'ce3', era: 3, hb: ['ce3'],
      title: 'The repeat customer',
      text: "A merchant lost a £220 'unauthorised' chargeback. The same customer, device and delivery address placed two undisputed orders in the previous four months.",
      opts: [
        { t: 'Nothing can be done', ok: false, why: 'There is a scheme programme designed for this exact pattern.' },
        { t: 'Represent with Visa Compelling Evidence 3.0, linking the earlier orders (matching device, IP, ID) to the disputed one', ok: true, why: 'Yes. CE 3.0 lets merchants defeat fraud chargebacks (10.4) by showing the same device or ID in earlier undisputed orders.' },
        { t: 'Refund the customer anyway', ok: false, why: 'That throws away a winnable case.' },
      ],
    },
  ];

  // Difficulty levels. Each fixes one era for the whole run.
  const DIFFICULTIES = {
    easy:   { name: 'Easy',   era: 1, title: 'Sponsored', blurb: 'You issue cards under a sponsor bank. You run the front line; the sponsor bank files chargebacks for you.', maxGrade: 'A' },
    medium: { name: 'Medium', era: 2, title: 'Issuer', blurb: 'You are a principal scheme member. You file chargebacks yourself, run a representment desk, and handle APP scams and Direct Debit claims. More volume and a daily membership cost.', maxGrade: 'S' },
    hard:   { name: 'Hard',   era: 3, title: 'Issuer and acquirer', blurb: 'You also acquire merchants. Chargebacks arrive from other banks, you chase merchant evidence, and if a merchant collapses the loss is yours.', maxGrade: 'S' },
  };

  // Start-of-run policies, locked for the run. rec marks the option recommended for first-timers.
  const POLICIES = {
    queue: { name: 'Queue rule', options: {
      fifo:      { name: 'First in, first out', line: 'Fair and simple, but urgent cases wait their turn and deadlines slip.' },
      edf:       { name: 'Earliest deadline first', line: 'Every team works the most urgent case first. Protects your on-time rate.', rec: true },
      regulated: { name: 'Regulated cases first', line: 'Unauthorised, scam and Direct Debit claims jump the queue. Protects heat, but ordinary cases wait and complaints rise.' },
    } },
    credit: { name: 'Credit policy', options: {
      always:    { name: 'Always credit', line: 'Refund every customer while the chargeback runs. Happier customers, but you pay out first and lose some on failed chargebacks.' },
      regulated: { name: 'Regulated cases only', line: 'Refund only where the law requires it up front. Cheaper, customers less happy.', rec: true },
    } },
    risk: { name: 'Risk stance', options: {
      strict:    { name: 'Strict', line: 'Decline weak claims early. Fewer losses and less work, but more declines and complaints.', rec: true },
      lenient:   { name: 'Lenient', line: 'Give customers the benefit of the doubt. Happier customers, but more losses and more first-party fraud paid out.' },
    } },
  };

  HANDBOOK.bpo = ['Outsourcing (BPO)', 'Disputes teams often use business process outsourcers for intake, evidence collection and complaints. It is cheaper and flexible, but quality is lower, errors are higher, and you stay responsible for customer data and for every regulatory deadline.'];
  const COLORS = { ordinary: ORANGE, regulated: CORAL, complaint: GOLD };
  const api = { TYPES, STATIONS, HANDBOOK, CLINIC, DIFFICULTIES, POLICIES, COLORS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GAMEDATA = api;
})(typeof window !== 'undefined' ? window : globalThis);
