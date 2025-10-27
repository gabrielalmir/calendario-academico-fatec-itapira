import fs from "node:fs/promises";
import { z } from "zod";

const EventSchema = z.object({
    start_date: z.string().optional().describe("Data de início do evento (YYYY-MM-DD)"),
    end_date: z.string().optional().describe("Data de término do evento, se for um intervalo"),
    dates: z.array(z.string()).optional().describe("Lista de datas específicas"),
    description: z.string().describe("Descrição detalhada do evento acadêmico"),
    category: z.enum([
        "feriado", "sem_aula", "avaliacao", "matricula",
        "evento_institucional", "reposicao", "outro"
    ]).describe("Classificação do tipo de evento"),
    has_class: z.boolean().describe("Indica se há aula neste dia"),
    notes: z.string().optional().describe("Campo opcional para observações")
});

const CalendarSchema = z.object({
    institution: z.string().optional().describe("Nome da instituição"),
    year: z.number().int().describe("Ano letivo").min(2000).max(2100),
    semester: z.enum(["1", "2"]).describe("Semestre do calendário (1 ou 2)"),
    months: z.array(
        z.object({
            month: z.string().describe("Nome do mês"),
            events: z.array(EventSchema).describe("Eventos ocorridos no mês")
        })
    ).describe("Lista dos meses cobertos"),
    summary: z.object({
        total_school_days: z.number().int().optional().describe("Total de dias letivos"),
    }).optional()
});

export type Calendar = z.infer<typeof CalendarSchema>;
export type CalendarEvent = z.infer<typeof EventSchema>;

async function writeSchemaFile(outputFile: string) {
    const schema = z.toJSONSchema(CalendarSchema, { target: "openapi-3.0" });
    await fs.writeFile(outputFile, JSON.stringify(schema, null, 2));
    console.log(`${outputFile} gerado com sucesso!`);
}

if (import.meta.main) {
    writeSchemaFile("agent.json");
}
