export function publicDemo() {
  return process.env.BANYAN_ACCESS === "public-demo";
}

export function collectionName() {
  return publicDemo() ? "cards_public_demo" : "cards";
}
