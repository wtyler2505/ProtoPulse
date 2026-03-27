const toolResponseOutput = {
  success: true,
  message: "Action switch_view dispatched to client",
  data: { type: "switch_view", view: "validation" }
};
const allToolCalls = [
  {
    id: "123",
    name: "switch_view",
    input: {},
    result: toolResponseOutput
  }
];

function extractClientActions(toolCalls) {
  return toolCalls
    .map(tc => tc.result.data)
    .filter((d) =>
      d != null && typeof d === 'object' && 'type' in d
    )
    .map(d => d);
}

console.log(extractClientActions(allToolCalls));
