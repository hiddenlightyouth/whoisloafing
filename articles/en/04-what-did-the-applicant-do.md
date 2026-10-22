---
title: What did this applicant actually build?
description: How to quickly understand an applicant's share of a team project repository, and what to keep in mind when reading the numbers.
---

There's a GitHub link on the resume. You click it and find a project built by four people. The README is clean and the product looks solid. But there's really only one thing you want to know.

**Which part of this did the applicant build?**

## Why the repository alone doesn't tell you

A team project repository is the work of the whole team. The applicant might have designed the core feature, or might have edited a few lines of copy. The polish you see on the surface doesn't tell those two apart.

To check directly, you'd have to filter the history down to the applicant's commits and open them one by one. With dozens of applicants, that's not realistic. So most reviewers skim the README, or ask "Which part did you work on?" in the interview instead.

## What to look at

### 1. How much they took part

Look at **both** commits and lines changed. Looking at just one is easy to misread.

- Many commits but few lines changed usually means someone who commits small and often, or who mostly handled small fixes.
- Few commits but many lines changed can mean someone who commits in big batches, or that generated files got mixed in.

When the two numbers disagree sharply, that alone makes a good interview question.

### 2. What they built

More important than how much someone took part is **what they built**. Seeing which features the applicant's commits cluster around tells you what "backend" on the resume actually means. You can also check whether the features they owned line up with the role they're applying for.

### 3. How they write code

How they name things, how finely they split functions, whether they handle edge cases, how they write comments. Take-home assignments are polished to impress, but commits in a team project show **everyday habits**.

### 4. How they work

- Did they contribute steadily throughout, or cram right before the deadline?
- Are their commit messages understandable to others?
- Did they open PRs and get reviews from teammates?

This kind of history is the closest preview you'll get of what working with them would be like.

## A faster way to check

Paste the repository link the applicant submitted into Lofy, and you'll get those four things as a conversation. For public repositories, there's nothing to install and no sign-in needed.

1. Paste the link, and you'll first see what the product is and its tech stack.
2. Choose **"Analyze who contributed and how much"** to see each contributor's commits, lines changed, and ranking.
3. Next, you'll get the **features each contributor likely worked on** and their **code style**.
4. When the analysis is done, choose **"Tell me more about a specific contributor"** and pick the applicant to see their numbers, activity hours, and features in one place.

Follow-up questions also show who did the most last-minute work and how PRs were exchanged.

## Please remember this when reading the numbers

This is the most important part. The analysis is material to help your judgment, not a score that replaces it. Contribution numbers are signals, not verdicts.

- **Some work never shows up in commits.** Planning, design meetings, UI design, reviewing teammates' code, and managing the schedule aren't captured. The person with the lowest share may be the one who actually led the team.
- **Pair-programmed code goes under one name.** If two people worked together and committed from one laptop, the other person leaves no trace.
- **Some teams squash commits.** In those teams, commit counts look much smaller than the actual amount of work.
- **Generated files inflate line counts.** Choose **"Leave them out"** when the analysis starts to see numbers without lock files and build output.
- **Some commits may not be linked to an account.** We do our best to merge by name and email, but commits made under a completely different name may appear as a separate person.
- **Private repositories aren't analyzed.** If the applicant submitted a private repository, you'll need another way to check.

For all these reasons, please don't use low numbers alone as a reason to reject an applicant.

## Turn it into interview questions

The analysis is most useful when you're preparing interview questions. Instead of vague questions, you can ask ones grounded in the record.

| What the history shows | What you could ask |
| --- | --- |
| Most of their commits are about payments | "What was the trickiest part of the payment flow?" |
| Commits bunch up in the last three days | "What happened near the end of the project? How would you plan the schedule next time?" |
| Very many lines changed relative to commits | "There's a large commit of yours. What was that work?" |
| A low share, but the resume says team lead | "Besides code, what roles did you mainly take on?" |
| They consistently followed the team's commit conventions | "Who set the team's rules, and how?" |

For applicants, too, a question that points at their actual work is much easier to answer than "Which part did you work on?" It also shows that you took the time to understand their work.

## In short

Repository analysis isn't a tool for filtering applicants out. It's a tool for **understanding them more accurately and preparing better questions**. The record tells you what they did. Why they did it, you have to hear from them.
