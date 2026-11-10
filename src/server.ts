import { createApp } from "./app";

if (process.env.NODE_ENV === "production" && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error("JWT_SECRET debe configurarse con al menos 32 caracteres en producción");
}

const port = Number(process.env.PORT ?? 3000);
const app = createApp();

app.listen(port, () => {
  console.log(`API disponible en http://localhost:${port}`);
  console.log(`Swagger disponible en http://localhost:${port}/api-docs`);
});
