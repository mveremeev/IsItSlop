// Set to 0 to hide the submit button on the results screen.
var enableSubmit = 1;

// Called when the user clicks Submit. Receives:
//   results  – { verdicts: {0: 'slop', 1: 'genuine', ...}, items: [...] }
//   code     – the private code string (empty string if none entered)
//
// Available globals:
//   items             – array of PR objects
//   privateCode       – user's private code string (from localStorage)
//   triageData        – persistent verdicts object, keyed by index (from localStorage)
//   receivedVerdicts  – verdicts fetched from remote verdict endpoints
//
// function onSubmit(results, code) { }
