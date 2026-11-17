# Changelog

## 0.1.0

- Feedback sheet with Problem, Request and Idea, and a short follow-up when something important is missing.
- Your own question above the box with `Bopmigo.open({ message })`.
- Replies from your inbox and messages your team starts, including "Open automatically".
- `identify`, `setContext`, `setScreen`, `showReplies` and an `unread` event for your own badge.
- Reports written offline are sent later, as the person who wrote them.
- On a shared phone, each person's unsent draft and conversation stay their own, including after the app restarts.
- Requests give up after 20 seconds instead of waiting forever on a stalled connection.
- Migo waves on the Feedback button while a reply or message is waiting, like the web widget (still with Reduce Motion).
- Optional screen picture with each report, using `react-native-view-shot`.
