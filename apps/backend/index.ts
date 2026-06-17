import express from "express"
import { preInterviewBody } from "./types";
const app = express();

app.use(express.json);

app.post("/api/v1/pre-interview", (req, res)=>{
    const {success, data} = preInterviewBody.safeParse(req.body);
})

app.listen(3001)