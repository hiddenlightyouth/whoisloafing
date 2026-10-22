---
title: What team rules should you define first?
description: Five agreements worth settling on day one of a new project, and how to borrow the rules of a team that already works well.
---

The first meeting of a team project usually settles only what to build and which technologies to use. How to work together gets pushed to "let's figure it out as we go." Two weeks later, the commit history is a mess and nobody knows who's doing what on which branch.

Rules don't need to be elaborate. Spend thirty minutes on day one deciding these five things and the whole project gets easier.

## 1. Commit messages

The first thing to agree on is the commit message format. The most common approach is to prefix the type of work.

```
feat: add sign-up
fix: screen freezes after sign-in
docs: improve setup instructions
```

These are the prefixes you'll use most.

| Prefix | When to use it |
| --- | --- |
| `feat` | You added a new feature |
| `fix` | You fixed a bug |
| `docs` | You changed documentation |
| `refactor` | You cleaned up code without changing behavior |
| `chore` | Any other small change |

Two more things are worth agreeing on at the same time.

- **Which language to write in**: Pick one and stick with it. Mixing languages makes the history hard to search later.
- **What to write**: Describe **what you did**, not which files you touched. "Add share button" reads much better than "Update Header."

## 2. Branches

Second, branch names. All you need is for the name to make the work obvious.

```
feat/login
fix/cart-total
12-order-history
```

Prefixing the type and including the issue number are the most common styles. Either is fine. What matters is that the team uses one consistently.

And settle one more agreement alongside it: **don't push straight to `main`**. Even on a team of two or three, that single rule dramatically cuts down on lost work.

## 3. Pull requests

When work on a branch is done, open a PR to merge it. With a PR template, nobody has to think about what to write each time. Three sections are enough to start.

```markdown
## What changed

## Why

## How I tested it
```

Things to decide together:

- **How many approvals before merging**: For a small team, one is enough.
- **How to merge**: Squashing keeps the history clean. Merging as is keeps the work process visible.
- **How big a PR can be**: Nobody properly reads a PR that takes more than ten minutes. Split it up.

## 4. Issues

Track tasks in issues, not in chat. Tasks in chat scroll up and disappear. Issues stay until they're closed.

- Put **one task** in each issue.
- Always assign an **owner**. Issues without an owner don't get done.
- Three or four **labels** for types of work are plenty.
- Put the **issue number** in branch names or commit messages to link the task to the work.

## 5. Automated checks

Last, automate what people used to check by hand. If every PR automatically checks that the build passes and the formatting is right, "it worked on my machine" goes away.

You don't need this from the very start. It's not too late to add once the first four are in place.

## Borrow the rules of a team that works well

Writing rules from a blank page is daunting. The fastest way is to **take the rules of a team that already works well and adapt them**.

1. Pick a public repository from a project you'd like to emulate.
2. Paste the link into Lofy and choose **"I want to borrow this team's workflow"**.
3. Read the branch names, commit messages, PR templates, and issue practices that team actually used.
4. Copy the team rules document in one click.
5. Trim and adjust it to fit your team's size and timeline.

If the repository has PR or issue template files, you'll see their full contents, each with its own copy button so you can reuse them right away.

## Making the rules stick

Agreeing on rules is easier than keeping them. A few tips:

- **Keep it short.** Five rules you can keep beat twenty you can't.
- **Write them down in the repository.** Chat announcements get buried fast. Put them in the README or a contributing guide where anyone can find them.
- **Write down the why.** Rules people understand get followed. Rules without reasons feel like chores.
- **Check in halfway.** Analyze your own repository midway through to see how closely you're actually following your commit conventions.
- **Change what doesn't fit.** If a rule slows the work down, the rule is wrong.

Thirty minutes on day one can save days in the final week. Next time you start a project, write one page of team rules before you write the feature list.
