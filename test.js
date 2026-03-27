const toolResponseOutput = {
  success: true,
  message: "Action switch_view dispatched to client",
  data: { type: "switch_view", view: "validation" }
};
const tc = {
  result: { data: toolResponseOutput }
};
console.log(tc.result.data);
console.log('type' in tc.result.data);
