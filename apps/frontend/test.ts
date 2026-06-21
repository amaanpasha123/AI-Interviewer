const response = await fetch("https://api.deepgram.com/v1/projects", {
  headers: {
    Authorization: `Token YOUR_DEEPGRAM_API_KEY`,
  },
});

console.log(response.status);
console.log(await response.text());