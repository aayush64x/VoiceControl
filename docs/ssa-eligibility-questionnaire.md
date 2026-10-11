# SSA Eligibility Questionnaire Walkthrough

## 1. Overview

**Target:** Social Security Administration (SSA) eligibility questionnaire

**Purpose:** Document the observed eligibility-checking flow, including its questions, input types, navigation, progress indicators, branching behavior, and results.

**Questionnaire introduction:** [Check eligibility for Social Security benefits](https://www.ssa.gov/prepare/check-eligibility-for-benefits)

**Questionnaire:** [Start the questionnaire](https://www.ssa.gov/prepare/check-eligibility-for-benefits/questionnaire)

**Results page:** [Questionnaire results](https://www.ssa.gov/prepare/check-eligibility-for-benefits/questionnaire/results)

**Related application guidance:** [How to apply for benefits](https://www.ssa.gov/apply/how-to-apply)

The questionnaire asks users about their circumstances to identify Social Security benefits they may qualify for. It provides preliminary guidance rather than a definitive eligibility decision.

## 2. Introduction Page

The introduction page is titled "Check eligibility for Social Security benefits."

It explains that users can answer a few questions to learn about possible benefits and what to do next.

**Observed elements:**

- Estimated completion time: 10 minutes or less
- Situations covered include retirement, disability or blindness, loss of a spouse, and difficulty paying for essential needs
- A Start button opens the questionnaire
- Input fields: None observed on the introduction page

## 3. Questionnaire Structure

The observed path contained 12 distinct questions. The questionnaire displayed a progress percentage and a Next button on the question screens.

The questions and progress percentages below describe the path observed during testing. Because the questionnaire branches based on answers, other users may see different questions or progress sequences.

| # | Progress | Question | Input type | Observed options or format |
|---|---|---|---|---|
| 1 | 2% | Who do you want to check eligibility for? | Single-select | An adult (age 18 and over); A child (under age 18) |
| 2 | 6% | Enter your date of birth. | Three-part date input | Month, day, and year fields; MM DD YYYY |
| 3 | 13% | Have you ever worked and paid Social Security taxes? | Single-select | Yes; No |
| 4 | 19% | Are you unable to work because of a condition? | Single-select | Yes; No |
| 5 | 23% | Will the condition affect your ability to work for a year or more, or result in death? | Single-select | Yes; No |
| 6 | 26% | When did the condition start to affect your ability to work? | Single-select | Before my 22nd birthday; After my 22nd birthday |
| 7 | 29% | Are you married? | Single-select | Yes; Yes, but we don't live together; No, I'm widowed or divorced; No, I've never been married |
| 8 | 71% | Do you have little or no income, or do you find it hard to pay for essentials like food, clothing, or a home every month? | Single-select | Yes; No |
| 9 | 74% | Does anyone in your household get government benefits that help pay for essentials like food, clothing, and a home? | Single-select | Yes; No; supporting examples include SNAP, Medicaid, and TANF |
| 10 | 77% | What's the value of your resources (things you own)? | Single-select | $0 to $2,000; $2,001 to $17,220; $17,221 and over |
| 11 | 90% | Do you have permanent kidney failure? | Single-select | Yes; No |
| 12 | 94% | What is your state or territory of residence? | Dropdown/select | State or territory selection |

### Additional question details

- **Date of birth:** The observed control used separate month, day, and year fields. A calendar date picker was not confirmed
- **Condition and disability questions:** Supporting text explained the meaning of a condition that limits work and its potential duration
- **Age-related question:** Supporting text referenced childhood, teenage years, and young adulthood
- **Household benefits:** Examples included SNAP, Medicaid, and Temporary Assistance for Needy Families (TANF)
- **Resources:** Supporting text described resources such as money in bank accounts and investments. It excluded the home the person lives in and the vehicle they drive
- **Permanent kidney failure:** Supporting text described end-stage renal disease (ESRD), including dialysis and kidney transplant situations
- **Residence:** The final observed question used a dropdown containing states and territories

## 4. Navigation and Conditional Behavior

### Question navigation

- **Next:** Advances from the current question
- **Progress indicator:** Displays a percentage of questionnaire completion
- The observed progress increased from 2% through 94% across the 12 questions
- The progress jump from 29% to 71% occurred along the answer-dependent path observed during testing
- The observed progress percentages should not be interpreted as a fixed sequence for every user. Different answers can change the questions presented and the path through the questionnaire

### Conditional questions

The questionnaire uses answers to determine the subsequent flow. The observed path included questions concerning disability, financial need, household benefits, resources, kidney failure, and residence.

The exact branching rules and every possible alternate path were not exhaustively tested. This documentation records the observed behavior rather than claiming to map the entire decision tree.

### Input types observed

- Single-select answer choices
- Three-part date-of-birth input
- State or territory dropdown/select
- No multi-select checkbox question was observed within the questionnaire path

## 5. Results Page

After completing the questionnaire, the results page displayed "You may be eligible for benefits" and showed progress at 100%.

### Potentially eligible benefit

Social Security Disability Insurance (SSDI) was identified as a possible benefit based on the responses concerning a condition limiting work and work/tax history.

The results page explained that the outcome was not a guarantee of eligibility. A definite determination requires the formal application and review process.

### Results-page controls and links

- **Back to previous question:** Returns to the previous questionnaire question
- **Leave questionnaire:** Provides a way to exit the questionnaire
- **Review your answers:** Expandable section for reviewing submitted responses
- **Edit links:** Allow individual answers to be revisited and changed
- **Learn how to apply:** Links to [SSA application guidance](https://www.ssa.gov/apply/how-to-apply)

### Benefits not identified as potential matches

A section titled "What you may not be eligible for and why" listed the following benefit categories with explanations:

- Retirement
- Family
- Lump-Sum Death Payment
- Survivor
- Medicare
- Supplemental Security Income (SSI)

The results page also provided links to additional information about these categories.

## 6. Related Application Guidance

The How to Apply page is a separate destination from the eligibility questionnaire.

**URL:** [https://www.ssa.gov/apply/how-to-apply](https://www.ssa.gov/apply/how-to-apply)

Observed content included:

- Guidance for applying for adult disability benefits and SSDI
- Eligibility information concerning disability and Social Security taxes
- An **Information we'll ask you to provide** section
- **Start an application** and **Finish existing application** options
- Other ways to apply, including arranging an appointment or contacting SSA
- Information about what happens after submission
- A disability decision-time lookup with month, year, and state controls

This page provides application instructions and entry points. The actual benefits application was not started or tested as part of this walkthrough.

## 7. Test Coverage and Limitations

### Completed observations

- [x] Questionnaire introduction page
- [x] Start button and questionnaire entry point
- [x] Twelve questions on the observed path
- [x] Question wording and answer choices
- [x] Observed input types
- [x] Progress percentages
- [x] Observed answer-dependent path
- [x] Results page and eligibility disclaimer
- [x] Review and edit answers controls
- [x] Links to additional benefit information and application guidance

### Not tested

- [ ] Every alternate branch and answer combination
- [ ] Validation behavior for missing or invalid inputs
- [ ] Keyboard-only navigation and screen-reader behavior
- [ ] Mobile and responsive layouts
- [ ] Actual benefits application submission
- [ ] Backend behavior, data retention, and session persistence
- [ ] Exact rules used to calculate each eligibility result

### Privacy note

This walkthrough documents the questions and interface behavior, not the tester's personal responses. Do not include actual dates of birth, income or resource amounts, or other personal eligibility answers in the shared project documentation.

## 8. Summary

The observed SSA questionnaire is a multi-step eligibility screening flow with single-select questions, a segmented date-of-birth input, a state/territory dropdown, progress indicators, and answer-dependent navigation.

The flow ends with a preliminary results page that explains potential benefits, provides reasons for other benefit categories not identified as matches, and links to further guidance. The questionnaire and the formal application process are separate.

The questionnaire and related informational pages were observed, but the formal application, alternate questionnaire paths, and other items listed under **Not tested** were not tested.
