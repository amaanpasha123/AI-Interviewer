import express from "express"
import { preInterviewBody } from "./types";
import axios from "axios";
import { scrapeGithub } from "./scrapers/github";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());

app.post("/api/v1/pre-interview", async (req, res)=>{
    const {success, data} = preInterviewBody.safeParse(req.body);
    if(!success){
        res.status(411).json({
            message : "Incorrect body"
        });
        return
    }
    const githubUrl = data.github.endsWith("/") ? data.github.slice(0,-1) : data.github; // https://github.com/amaanpasha
    
    const githubUsername = githubUrl.split("/").pop();

    if(!githubUsername){
        return res.status(400).json({
            message : "Invalid github URL"
        })
    }

    const githubData = await scrapeGithub(githubUsername);

    
    console.log(githubData);
    res.json({github : githubData});


})

app.listen(3001, ()=>{
    console.log("server is running");
});