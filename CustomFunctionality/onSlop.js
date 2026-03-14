// Called when a PR is marked as slop.
//   item  – the PR object that was rated
//   index – its position in the items array
//
// Available globals:
//   items             – array of PR objects
//   privateCode       – user's private code string (from localStorage)
//   triageData        – persistent verdicts object, keyed by index (from localStorage)
//   receivedVerdicts  – verdicts fetched from remote verdict endpoints
//
// function onSlop(item, index) { }
