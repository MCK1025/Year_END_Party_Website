// Negative Y rotation lifts the free right edge toward the reader around a left-hand binding.
export const notebookFold = {
  flat: "perspective(1500px) rotateY(0deg)",
  leftHinge: "perspective(1500px) rotateY(-96deg)",
  duration: 640,
  easing: "ease-in-out",
} as const;
