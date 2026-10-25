import "reflect-metadata";

import { ServerContainer } from "./composition/index.ts";

const port = Number(process.env.PORT ?? "8787");
await new ServerContainer().listen(Number.isFinite(port) ? port : 3000);
