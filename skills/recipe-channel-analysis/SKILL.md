---
name: recipe-channel-analysis
description: "Recipe for analyzing TalkValue channel performance: discover channel and event IDs, run channel-event attribution, and measure audience overlap between 2-5 channels. Use when the user asks about channel attribution, channel performance vs events, or audience overlap between marketing channels."
---

# Recipe: Channel Analysis

> **PREREQUISITE:** Load the following skills to execute this recipe: talkvalue-analysis, talkvalue-channel, talkvalue-event

## Steps

1. List channels to identify the ones to analyze:

   ```bash
   talkvalue path channel list --json
   ```

2. List events to find relevant event IDs:

   ```bash
   talkvalue path event list --json
   ```

3. Run channel-event attribution for a specific channel:

   ```bash
   talkvalue path analysis channel attribution <channelId> \
     --event-id <eventId1> \
     --event-id <eventId2> \
     --json
   ```

4. Run audience overlap across 2 to 5 channels:

   ```bash
   talkvalue path analysis channel audience \
     --channel-id <id1> \
     --channel-id <id2> \
     --channel-id <id3> \
     --json
   ```

## Tips

- Attribution shows how many people from a channel attended each specified event. Pass multiple `--event-id` flags to compare across events in one call.
- Audience overlap requires at least 2 channels and accepts up to 5. The result shows the count of contacts shared between each pair.
