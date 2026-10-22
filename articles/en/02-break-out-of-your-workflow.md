---
title: Don't get trapped in your first team workflow
description: The way your first team worked can quietly harden into "the only right way." Here's how to read other teams' workflows and bring the good parts into yours.
---

Most of us learn how to collaborate from our first team. If the first lead said to push straight to `main`, we did that. If they insisted on feature branches, we did that instead. Before long, that way of working becomes "just how everyone does it."

The problem is that we use it not because we chose it, but **because it was the first one we saw**. If you've never seen another way, it's hard to even notice that your current way is painful.

## Does this look familiar?

If any of these scenes ring a bell, it's a good time to look at how other teams work.

- Commits pile up the night before a deadline, and merging blows up into conflicts.
- Commit messages read "fix", "final", "really final", "bug fix".
- PRs get opened, but nobody reads them before merging.
- The only way to know who's doing what is to ask in chat.
- Two people edited the same file at once, and one person's work disappeared.

These things don't keep happening because teammates are lazy. Most of the time, it's because **there's no agreement, or the agreement doesn't fit the team**.

## Teams really do work differently

Compare just a few public repositories and you'll see how varied the approaches are.

| Area | Some teams | Other teams |
| --- | --- | --- |
| Branches | Create a branch per feature and merge through PRs | Push straight to `main` because the team is small |
| Branch names | Prefix the type, like `feat/login` | Include the issue number, like `12-login` |
| Commit messages | Use prefixes, like `feat: add sign-in` | Write plain sentences with no prefix |
| Merging | Squash commits into one | Keep the full commit history |
| Task tracking | Carefully assign owners and labels on issues | Split tasks in chat, no issues |
| Unit of work | Push small changes several times a day | Push once when a feature is done |

Neither column is always right. A three-person project that lasts a week needs different agreements than a ten-person project that lasts a year. What matters is **knowing several options and choosing among them**.

## How to read another team's workflow

A workflow is recorded more accurately in history than in documents. These five things give you the outline of how a team works.

1. **Branch names**: Do they use type prefixes, issue numbers, or people's names?
2. **Commit messages**: Are there prefixes? What language are they in? How specific are they?
3. **PRs**: Is there a template? What goes in it? How are PRs merged?
4. **Issues**: What's the title format? Are labels and owners used?
5. **Repository setup**: Are there automated checks? Is there a contributing guide?

You can check each of these yourself, or paste the repository link into Lofy and choose **"I want to borrow this team's workflow"** to get it all in one place. You'll see the branch names and commit messages the team actually used, the items in their PR template, how they managed issues, and the order to adopt it in your own team. If you like what you see, you can copy a ready-made team rules document in one click.

## Don't change everything at once

If you adopt everything that looks good, it usually falls apart within a week. The more rules you add, the harder they are to keep. We recommend bringing them in **one at a time**, in roughly this order.

1. **Start with commit message prefixes.** They cost the least and pay off immediately.
2. **Agree on branch naming.** You'll be able to see who's working on what from the branch list alone.
3. **Add a PR template.** Two or three fields for what changed and why are enough.
4. **Split work into issues.** Tasks scattered across chat end up in one place.
5. **Add automated checks.** Hand off what people used to check manually to a machine.

Try each one for about two weeks, and move on once the team is comfortable. If something doesn't fit, drop it. Agreements exist to make the team's life easier, not to be followed for their own sake.

## Look at your own team, too

Once you've studied another team, analyze your own repository with the same eyes. You'll notice more than you expect.

- Are we really working in small pieces?
- Are commits bunched up on certain days or right before deadlines?
- How closely are we actually following the commit conventions we agreed on?

Instead of ending a retrospective with "let's do better next time," **looking at the history together** leads to much more specific conversations about what to change.

If your current workflow feels comfortable, by all means keep it. Just know that comfort you chose after seeing the alternatives is different from comfort you stay in because you never looked.
