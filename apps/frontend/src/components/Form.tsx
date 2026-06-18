import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import axios from "axios";
import { BACKEND_URL } from "../lib/config";
import { useNavigate } from "react-router";

export function Form() {
  const [github, setGithub] = useState("");
  const navigate = useNavigate();

  async function onSubmit() {
    if (!github) {
      //Todo add more validation over here...
      toast("Please provide valid github and linkedin URL");
      return;
    }
    const response =  await axios.post(`${BACKEND_URL}/api/v1/pre-interview`, {
      github,
    });

    navigate(`/interview/${response.data.id}`);
    
  }

  return (
    <div className="h-screen w-screen flex justify-center items-center">
      <div>
        <h1 className="scroll-m-20 text-center text-4xl font-extrabold tracking-tight text-balance">
          AI Interview start
        </h1>
        <div className="p-2">
          <Input
            placeholder="Github URL"
            onChange={(e) => setGithub(e.target.value)}
          />
        </div>
        <div className="flex justify-center p-4">
          <Button onClick={onSubmit}>Start interview</Button>
        </div>
      </div>
    </div>
  );
}
