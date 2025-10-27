import { TodoistApi } from "@doist/todoist-api-typescript";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { JSDOM } from "jsdom";
import { env } from "./env";

const GEMINI_MODEL = "gemini-2.5-pro";
const FATEC_URL = "https://fatecitapira.cps.sp.gov.br/";
const SCHEMA_AGENT_FILE = "agent.json";

const todoist = new TodoistApi(env.TODOIST_API_KEY);

async function main() {
    const retrievedAcademicCalendar = await extractAcademicCalendar();

    if (!retrievedAcademicCalendar) {
        console.log('Academic calendar not found!');
        return;
    }

    const projectId = env.TODOIST_PROJECT_ID;
    const sectionId = env.TODOIST_SECTION_ID;
    const calendarJson = await Bun.file(retrievedAcademicCalendar).json();

    // delete current tasks
    const currentTasks = (await todoist.getTasks({ projectId, sectionId })).results;

    for (const task of currentTasks) {
        console.log(`Deletando task (#${task.id}) = ${task.content}`);
        await todoist.deleteTask(task.id);
    }

    let totalEvents = 0;

    for (const month of calendarJson.months) {
        for (const event of month.events) {
            const today = new Date();
            const startDate = new Date(event.start_date);

            if (today > startDate) {
                console.log(`Ignorando task ${event.description}, pois a data já passou!`);
                continue;
            }

            await todoist.addTask({
                content: event.description,
                dueString: event.start_date,
                sectionId,
                projectId,
                labels: [event.category],
            });
            totalEvents += 1;
        }
    }

    console.log(`${totalEvents} tasks criadas no Todoist!`);
}

/**
 * Função de extração de calendário acadêmico
 */
async function extractAcademicCalendar() {
    console.log("Iniciando processo de extração do calendário...");

    const { year, semester } = getYearSemester();
    console.log(`Ano: ${year}, Semestre: ${semester}`);

    const calendarIdentifier = `calendario_academico_${year}-${semester}`;
    const calendarFilename = `${calendarIdentifier}.pdf`;

    if (!(await Bun.file(calendarFilename).exists())) {
        console.log(`PDF não encontrado. Baixando de ${FATEC_URL}...`);
        await downloadCalendar(FATEC_URL, calendarFilename);
        console.log(`Calendário salvo como: ${calendarFilename}`);
    } else {
        console.log(`Arquivo PDF já existente: ${calendarFilename}`);
    }

    const calendarFilenameJson = `${calendarIdentifier}.json`;
    if (await Bun.file(calendarFilenameJson).exists()) {
        console.log(`Arquivo JSON do calendário já existe: ${calendarFilenameJson}`);
        return calendarFilenameJson;
    }

    const jsonSchema = await createJsonSchema(SCHEMA_AGENT_FILE);
    console.log("JSON schema carregado de agent.json.");

    console.log("Enviando PDF para a API Gemini. Isso pode levar um momento...");
    const jsonResponse = await queryGeminiApi(calendarFilename, jsonSchema);
    console.log("Dados extraídos da API Gemini.");

    await saveCalendarJson(calendarIdentifier, jsonResponse);
    console.log(`Dados do calendário salvos em: ${calendarIdentifier}.json`);
    console.log("Processo concluído com sucesso!");

    return calendarFilenameJson;
}

/**
 * Carrega o JSON schema de um arquivo local.
 */
async function createJsonSchema(agentFile: string): Promise<any> {
    try {
        const schemaStr = await Bun.file(agentFile).text();
        return JSON.parse(schemaStr);
    } catch (error) {
        console.error(`Falha ao ler ou parsear o arquivo de schema: ${agentFile}`);
        throw error;
    }
}

/**
 * Envia o PDF e o schema para a API Gemini para extração de dados.
 */
async function queryGeminiApi(filename: string, schema: any): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error("A variável de ambiente GEMINI_API_KEY não está definida.");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
        model: GEMINI_MODEL,
    });

    const pdfBuffer = await Bun.file(filename).arrayBuffer();
    const pdfBase64 = Buffer.from(pdfBuffer).toString("base64");

    const textPart = {
        text: "Extraia os eventos do calendário acadêmico do arquivo PDF anexado e formate-os de acordo com o JSON schema fornecido.",
    };

    const filePart = {
        inlineData: {
            data: pdfBase64,
            mimeType: "application/pdf",
        },
    };

    try {
        const result = await model.generateContent({
            contents: [{ role: "user", parts: [textPart, filePart] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
            },
        });

        const response = result.response;
        const jsonText = response.text();

        const json = JSON.parse(jsonText);
        return JSON.stringify(json, null, 2);

    } catch (error) {
        console.error("Erro ao chamar a API Gemini:", error);
        throw error;
    }
}

/**
 * Salva o conteúdo JSON em um arquivo.
 */
async function saveCalendarJson(identifier: string, jsonContent: string): Promise<void> {
    const filename = `${identifier}.json`;
    await Bun.write(filename, jsonContent);
}

/**
 * Retorna o ano e o semestre (1 ou 2) atuais.
 */
function getYearSemester(): { year: number; semester: number } {
    const now = new Date();
    const month = now.getMonth() + 1;
    const semester = month <= 6 ? 1 : 2;
    return { year: now.getFullYear(), semester };
}

/**
 * Baixa o arquivo PDF do calendário.
 */
async function downloadCalendar(baseUrl: string, outputFile: string): Promise<void> {
    const calendarLink = await getCalendarLink(baseUrl);
    if (!calendarLink) {
        throw new Error(`Não foi possível encontrar o link do calendário em ${baseUrl}`);
    }

    const absoluteUrl = new URL(calendarLink, baseUrl).href;
    console.log(`Link do calendário encontrado: ${absoluteUrl}`);

    const pdfResponse = await fetch(absoluteUrl);
    if (!pdfResponse.ok) {
        throw new Error(`Falha ao baixar o PDF: ${pdfResponse.statusText}`);
    }

    const pdfBytes = await pdfResponse.arrayBuffer();

    await Bun.write(outputFile, pdfBytes);
}

/**
 * Varre a página HTML em busca do link do PDF do calendário.
 */
async function getCalendarLink(url: string): Promise<string | null> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Falha ao buscar a página: ${response.statusText}`);
        }
        const html = await response.text();

        const dom = new JSDOM(html);
        const document = dom.window.document;

        const links = document.querySelectorAll("a");

        for (const link of links) {
            const linkText = (link.textContent || "").trim();
            const normalizedText = linkText.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

            if (normalizedText.includes("calendario academico")) {
                const href = link.getAttribute("href");
                if (href) {
                    return href;
                }
            }
        }

        return null;
    } catch (error) {
        console.error(`Erro ao tentar encontrar o link do calendário em ${url}:`, error);
        throw error;
    }
}

main();
