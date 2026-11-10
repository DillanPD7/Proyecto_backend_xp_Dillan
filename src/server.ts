import { createApp } from "./app";

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`API disponible en http://localhost:${port}`);
  console.log(`Swagger disponible en http://localhost:${port}/api-docs`);
});
