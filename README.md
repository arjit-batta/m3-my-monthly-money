# M3 — My Monthly Money 💰

A mobile-first personal budgeting PWA built for India.

**Live app:** https://simple-rupee-plan.lovable.app

---

## The Problem

Most budgeting apps are built for Western markets — they assume credit cards, 
bank syncing, and simple spending categories. Indian personal finance is more 
complex: multiple UPI accounts, credit cards across banks, cash, and spending 
patterns that don't map to Western categories.

I couldn't find an app that matched how I actually spend money. So I built one.

---

## What It Does

- **Expense tracking** — Log transactions with category, sub-category, payment 
  mode, and date
- **Budget management** — Set monthly budgets at category and sub-category level; 
  track % used in real time
- **Analytics** — Weekly expense trends, spending by category breakdown, 
  month-on-month navigation
- **Payment mode tracking** — Track spend across UPI accounts, credit cards, cash

---

## Product Decisions Worth Noting

**Why category + sub-category?**
A single "Food" category isn't useful. Knowing that ₹7,347 went to Food, split 
across Swiggy, groceries, and eating out — that's actionable. The hierarchy was 
designed after mapping my own spending patterns for the first month.

**Why payment mode tracking?**
Reward points, cashback, and credit card cycles make payment mode a meaningful 
variable in Indian personal finance. Knowing I spent ₹1,520 on a specific card 
matters for optimizing card usage and cashback.

**Why PWA over native app?**
Zero install friction. Works on mobile browser, can be added to home screen, 
no App Store approval cycle. Right call for a solo-user MVP.

---

## Usage

- **250+ transactions** recorded over several months of daily use
- Used as primary personal finance tool — not a demo, a real product
- Iterated continuously based on daily dogfooding

---

## Current Limitations

- Manual entry only — no bank sync or UPI auto-import
- Single user — no multi-user or shared expense support
- No recurring expense automation

---

## Roadmap (Next Features)

- [ ] **Voice expense entry** — Speak "spent 330 on food via Swiggy" → auto-logged
- [ ] **Monthly AI summary** — LLM-generated end-of-month spending analysis with 
      patterns and recommendations
- [ ] **Recurring expense detection** — Auto-identify and suggest automating 
      fixed monthly expenses
- [ ] **Budget rollover logic** — Carry unspent budget to next month by category

---

## Built With

- **Lovable** — AI-assisted development for rapid prototyping
- **React + PWA** — Frontend framework
- **Supabase** — Backend and auth

---

## Why I Built This as a PM

I wanted hands-on experience shipping a real product end-to-end — not a toy 
demo, but something I'd use daily and iterate on based on real friction.

The constraint of being a non-technical PM using AI-assisted tools also gave 
me direct experience with the trade-offs of AI-generated code: speed of 
prototyping vs. technical debt, prompt quality vs. output quality, and 
knowing when to accept a shortcut vs. when it'll cost you later.
