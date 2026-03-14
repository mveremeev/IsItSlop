// Called when a PR is skipped.
//   item  – the PR object that was skipped
//   index – its position in the items array
//
// Available globals:
//   items             – array of PR objects
//   privateCode       – user's private code string (from localStorage)
//   triageData        – persistent verdicts object, keyed by index (from localStorage)
//   receivedVerdicts  – verdicts fetched from remote verdict endpoints
//
// function onSkip(item, index) { }
