---
title: Commits vs. lines changed: how should we read contribution?
description: In the same repository, the contribution ranking can flip depending on the measure. Here's what each number tells you and how to read them together.
---

Lofy doesn't show contribution as a single number. It shows two side by side: **share by commits** and **share by lines changed**. People sometimes ask, "So who did the most?" There's a reason we don't merge them into one number.

## What commit counts tell you

Commit counts show **how often someone pushed work**. They're a good way to gauge whether someone stayed involved in the project over time.

But commits come in very different sizes.

- One person commits once to change a button color, and again to fix a typo.
- Another person commits three days of feature work all at once.

Compare their commit counts directly and the first person looks like they did far more. Commit counts depend heavily on **working habits**.

## What line counts tell you

Lines changed is the sum of lines added and lines removed. It shows **how much the code changed**.

This number has traps too.

- **Auto-generated files** inflate it dramatically. Installing one package can change thousands of lines in a lock file.
- **Moving files or reformatting** produces huge line counts even when nothing really changed.
- **Good code is often shorter.** Someone who cuts a hundred lines down to twenty did great work, but the number comes out small.
- UI code tends to run long, while the fix for a tricky bug can be a single line.

Line counts depend heavily on **the kind of work**.

## So we show both

Put the two numbers side by side and you see things that one alone hides.

| By commits | By lines | It might mean |
| --- | --- | --- |
| High | High | Someone who steadily drove the whole project |
| High | Low | Commits small and often, or mostly handled fixes and finishing work |
| Low | High | Shipped big features in one go, or built the initial skeleton |
| Low | Low | Joined late, or took on work outside the code |

Lofy introduces contributors in order of the average of the two shares. That way, neither working habit gets an unfair advantage.

## Making the numbers more accurate

### Leaving out generated files

When contribution analysis starts, you're asked whether to leave out lock files and build output.

- **Include everything** is fast, but line counts from generated files go straight in.
- **Leave them out** reads the latest 300 commits one by one and removes lock files, build output, generated files, and binary files like images from line counts. It takes a bit longer, but the numbers are much closer to code people actually wrote.

If the line-based share looks heavily skewed toward one person, try running it again with generated files left out. The result can change quite a bit.

### Merge commits and bots are excluded from the start

Merge commits created automatically when branches are combined, and commits from bot accounts that bump dependencies, are left out of the counts. They aren't work done by people.

### The same person is counted once

It's common to commit from a home laptop and a school computer with different emails. Commits from the same GitHub account are merged into one person, and commits not linked to an account are matched by email and name.

## Contributions that numbers can't capture

No matter how precisely we count, work that isn't recorded can't become a number.

- Deciding what to build and designing screens
- Reading teammates' code and leaving feedback
- Sitting next to a stuck teammate and solving the problem together
- Managing the schedule and preparing the presentation
- Configuring the deployment environment directly in a dashboard

That's why Lofy doesn't just hand you numbers. It also summarizes each contributor's **features** and **code style**. "Built the sign-in and payment screens, and tends to handle edge cases carefully" says far more about a person than "30% contribution."

## In one line

Commits tell you **how often**. Lines tell you **how much**. Features and code style tell you **what and how**. Contribution only becomes readable when you look at all three together.

Contribution numbers are signals, not verdicts. If a number comes out differently than you expected, look into why before dismissing it as wrong. There's usually a story about how the team works hiding behind it.
