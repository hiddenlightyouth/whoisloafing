---
title: How to turn a team project into portfolio proof
description: The hardest part of putting a team project in your portfolio is describing your own share accurately. Here's how to pull evidence from the repository and fit it on one page.
---

When a project wraps up and you sit down to write your portfolio, the words don't come easily. You worked hard on it for months, yet all you can think to write is "Built an e-commerce site with React, frontend."

The reason is simple. Your memory has faded, and you don't have **evidence of what you did** in front of you. But that evidence is already sitting in the repository.

## The questions a portfolio has to answer

When someone reads about a team project in your portfolio, they really want to know three things.

1. **What** is this project?
2. What did **this person** do in it?
3. **How does this person work**?

Many portfolios answer the first question at length and squeeze the second and third into a single line like "frontend." Yet those are exactly the two things the reader most wants to know.

## Common mistakes

- **Mixing what the team did with what you did.** If you write "Built real-time chat" but you only built the UI, a server-side question in the interview will put you on the spot.
- **Listing technology names only.** A tech stack list tells people what you used, not what you did with it.
- **Being vague about your role.** "Order and payment APIs, admin analytics queries" says far more than "backend development."
- **Claiming scale without evidence.** "Handled most of the project" only carries weight when numbers back it up.

## Pulling material out of the repository

### 1. Define the project in one sentence

Write down who it's for and what it does in a single sentence. You'll want to explain more, but readers decide whether to keep going based on that first sentence.

> A web service that analyzes a team project's GitHub repository and explains each contributor's share in a conversation

### 2. Group the tech stack by type

Split it into languages, frameworks, databases, and deployment. A small table or grouped list reads much better than one long line.

### 3. Break your work into features

This is the most important part. Skim your commits from the beginning and **group them by feature**. Rather than one sentence, aim for three to eight items.

- Social sign-in and token refresh
- Infinite scroll and search filters for the product list
- Cart quantity changes and price calculation
- Order history screen and shipping status

Written this way, readers can pick the item they're curious about and ask you about it.

### 4. Back it up with numbers

Include your commits, lines added and removed, and your share within the team. Use the numbers **only to support your claims**, though. When the numbers themselves become the brag, it backfires.

One thing to watch for: auto-generated files like package lock files or build output can inflate line counts dramatically. Numbers calculated without those files are more honest, and easier to stand behind when someone asks.

### 5. Show how you work

Whether you followed commit conventions, how you opened PRs, and how small you kept your changes are all evidence that **you know how to collaborate**. "Split work into feature branches and requested reviews using the PR template" is far more concrete than "Experienced in collaboration."

## Gather the material in five minutes

Collecting those five things by hand means opening commits one by one, which takes a while. Paste the repository link into Lofy and you get the material in one go.

| What your portfolio needs | What Lofy gives you |
| --- | --- |
| A one-line project intro | A one-sentence summary of the repo |
| Tech stack | Tech stack grouped by type |
| The features you built | A feature list for each contributor |
| Numbers as evidence | Commits, lines changed, and contribution share by both measures |
| How you work | Code style, commit conventions, and activity hours |

Before the analysis starts, you'll be asked whether to leave out lock files and build output. For numbers you plan to put in a portfolio, we recommend **leaving them out**. Once the analysis is done, choose **"Tell me more about a specific contributor"** and pick your name to see just your share.

Sign in and click **Share** to save the result to My chats and turn it into a link. Put that link in your portfolio so readers can check the evidence themselves. While a chat is shared, the analysis can't be continued, so ask everything you need before sharing. If you want to ask more later, just stop sharing from My chats.

## Don't paste the results as is

The analysis is raw material. Your portfolio should be in your own words. For each item in your feature list, add a sentence or two about these three things.

- **Why** did you build it this way?
- **What was hard**, and how did you solve it?
- **What would you do differently** next time?

The history only tells you what was done. Why it was done that way is yours to fill in, and that's usually the most interesting part of a portfolio.

## Good to know

- Only **public repositories** can be analyzed. If yours is private, make it public for a while, or first check with your team that it's okay to make public.
- If you committed with several emails linked to the same GitHub account, they're counted as one person. If you ever committed with an email that isn't linked, add that email to your account in your GitHub settings.
- **Contributions that don't show up in commits**, like planning, design, or preparing the presentation, aren't captured in the numbers. If you did that work, describe it separately in your portfolio.
