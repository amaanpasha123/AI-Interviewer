import z from "zod"

export const preInterviewBody = z.object({
    github : z.string()
})

