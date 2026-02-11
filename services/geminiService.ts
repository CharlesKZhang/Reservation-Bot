import { GoogleGenAI, Chat, FunctionDeclaration, Type } from "@google/genai";
import { RestaurantAvailabilityResult, BookingResult, AvailableSlot, FunctionCallMessage, ToolResponseMessage } from '../types';

// Utility to ensure API key is available
const getApiKey = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is not defined in environment variables.");
  }
  return apiKey;
};

// Dummy functions to simulate restaurant operations
const dummyRestaurantDB = {
  availability: {
    "2024-08-01": {
      "18:00": { 2: true, 4: true },
      "18:30": { 2: true, 4: false },
      "19:00": { 2: true, 4: true },
      "19:30": { 2: false, 4: true },
      "20:00": { 2: true, 4: true },
      "20:30": { 2: true, 4: false },
    },
    "2024-08-02": {
      "18:00": { 2: true, 4: true },
      "18:30": { 2: true, 4: true },
      "19:00": { 2: true, 4: true },
      "19:30": { 2: true, 4: true },
      "20:00": { 2: true, 4: true },
      "20:30": { 2: true, 4: true },
    }
  },
  bookings: [] as { date: string, time: string, partySize: number, confirmation: string }[]
};

/**
 * Checks restaurant availability for a given date, time, and party size.
 * @param {string | undefined} restaurant_name - The name of the restaurant.
 * @param {string} date - The date of the reservation (e.g., "2024-08-01").
 * @param {string} time - The preferred time (e.g., "19:00").
 * @param {number} partySize - The number of people.
 * @param {'OpenTable' | 'Tock' | undefined} platform - The reservation platform.
 * @returns {RestaurantAvailabilityResult} An object indicating availability and potential alternative slots.
 */
async function check_restaurant_availability(
  restaurant_name: string | undefined,
  date: string,
  time: string,
  partySize: number,
  platform: 'OpenTable' | 'Tock' | undefined,
): Promise<RestaurantAvailabilityResult> {
  console.log(`TOOL CALL: Checking availability for ${restaurant_name || 'unknown restaurant'} on ${platform || 'any platform'} for ${partySize} on ${date} at ${time}`);
  await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate API call delay

  const dayAvailability = dummyRestaurantDB.availability[date];
  if (!dayAvailability) {
    return { available: false, message: "No availability found for this date." };
  }

  const requestedSlotAvailable = dayAvailability[time]?.[partySize] || false;

  const availableSlots: AvailableSlot[] = [];
  const requestedTime = new Date(`2000-01-01T${time}:00`); // Use a dummy date for time comparison

  for (const slotTime in dayAvailability) {
    const slotDateTime = new Date(`2000-01-01T${slotTime}:00`);
    const diffMinutes = Math.abs((slotDateTime.getTime() - requestedTime.getTime()) / (1000 * 60));

    // Check slots within +/- 30 minutes
    if (diffMinutes <= 30) {
      if (dayAvailability[slotTime]?.[partySize]) {
        availableSlots.push({ time: slotTime, isAvailable: true });
      } else {
        availableSlots.push({ time: slotTime, isAvailable: false });
      }
    }
  }

  // Sort by time
  availableSlots.sort((a, b) => {
    const timeA = new Date(`2000-01-01T${a.time}:00`).getTime();
    const timeB = new Date(`2000-01-01T${b.time}:00`).getTime();
    return timeA - timeB;
  });

  const actuallyAvailableSlots = availableSlots.filter(s => s.isAvailable);

  if (requestedSlotAvailable) {
    return { available: true, availableSlots: [{ time, isAvailable: true }], message: "Slot is available." };
  } else if (actuallyAvailableSlots.length > 0) {
    return { available: false, availableSlots: actuallyAvailableSlots, message: "Requested slot unavailable, but other nearby slots are available." };
  } else {
    return { available: false, message: "No suitable slots found within 30 minutes of your requested time." };
  }
}

/**
 * Books a restaurant table for a given date, time, and party size.
 * @param {string | undefined} restaurant_name - The name of the restaurant.
 * @param {string} date - The date of the reservation.
 * @param {string} time - The time of the reservation.
 * @param {number} partySize - The number of people.
 * @returns {BookingResult} An object indicating success and a confirmation number.
 */
async function book_table(
  restaurant_name: string | undefined,
  date: string,
  time: string,
  partySize: number,
): Promise<BookingResult> {
  console.log(`TOOL CALL: Attempting to book table for ${restaurant_name || 'unknown restaurant'} for ${partySize} on ${date} at ${time}`);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate API call delay

  const dayAvailability = dummyRestaurantDB.availability[date];
  if (!dayAvailability || !dayAvailability[time] || !dayAvailability[time][partySize]) {
    return { success: false, message: "The requested slot is no longer available or never existed." };
  }

  // Simulate booking: mark as unavailable and generate confirmation
  dummyRestaurantDB.availability[date][time][partySize] = false;
  const confirmationNumber = `RES-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  dummyRestaurantDB.bookings.push({ date, time, partySize, confirmation: confirmationNumber });

  return { success: true, confirmationNumber, message: "Booking successful." };
}

// Function declarations for Gemini
const checkRestaurantAvailabilityDeclaration: FunctionDeclaration = {
  name: 'check_restaurant_availability',
  parameters: {
    type: Type.OBJECT,
    description: 'Checks the availability of a restaurant table.',
    properties: {
      restaurant_name: {
        type: Type.STRING,
        description: 'The name of the restaurant (e.g., "The Fancy Bistro").',
      },
      date: {
        type: Type.STRING,
        description: 'The date for the reservation in YYYY-MM-DD format (e.g., "2024-08-01").',
      },
      time: {
        type: Type.STRING,
        description: 'The preferred time for the reservation in HH:MM format (e.g., "19:00").',
      },
      partySize: {
        type: Type.INTEGER,
        description: 'The number of people for the reservation.',
      },
      platform: {
        type: Type.STRING,
        enum: ['OpenTable', 'Tock'],
        description: 'The reservation platform (e.g., "OpenTable", "Tock").',
      },
    },
    required: ['date', 'time', 'partySize'], // restaurant_name and platform are optional for now
  },
};

const bookTableDeclaration: FunctionDeclaration = {
  name: 'book_table',
  parameters: {
    type: Type.OBJECT,
    description: 'Books a restaurant table after availability has been confirmed.',
    properties: {
      restaurant_name: {
        type: Type.STRING,
        description: 'The name of the restaurant to book at.',
      },
      date: {
        type: Type.STRING,
        description: 'The date for the reservation in YYYY-MM-DD format.',
      },
      time: { // Renamed description to confirmed_time in the prompt, but keeping actual parameter name as 'time' for consistency with check_restaurant_availability outputs.
        type: Type.STRING,
        description: 'The confirmed time for the reservation in HH:MM format.',
      },
      partySize: {
        type: Type.INTEGER,
        description: 'The number of people for the reservation.',
      },
    },
    required: ['date', 'time', 'partySize'], // restaurant_name is optional for now
  },
};

export class ReservationAgentService {
  private chat: Chat | null = null;
  private readonly toolFunctions: Record<string, Function> = {
    check_restaurant_availability: check_restaurant_availability,
    book_table: book_table,
  };

  constructor() {
    this.initChat();
  }

  private initChat() {
    // Always use `const ai = new GoogleGenAI({apiKey: process.env.API_KEY});`.
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    this.chat = ai.chats.create({
      // Use 'gemini-3-flash-preview' for basic text tasks and function calling.
      model: 'gemini-3-flash-preview',
      config: {
        tools: [{
          functionDeclarations: [
            checkRestaurantAvailabilityDeclaration,
            bookTableDeclaration,
          ],
        }],
        systemInstruction: `You are a helpful and efficient restaurant reservation agent.
          When a user asks for a table, you must determine the 'restaurant_name', 'date', 'time', 'partySize', and 'platform' (if any) for the reservation.
          If 'restaurant_name' or 'platform' is not provided, ask the user for this information. Assume "tonight" refers to the current date: ${new Date().toISOString().slice(0, 10)}.
          Once you have the necessary information, use the 'check_restaurant_availability' tool to see if a slot is available.
          If 'restaurant_name' is not specified, assume the user is asking about "Our Restaurant". If 'platform' is not specified, assume "any platform".
          If a slot is found within 30 minutes of their requested time (before or after), call the 'book_table' tool immediately with the *most suitable available slot's time*, including the 'restaurant_name', 'date', and 'partySize'.
          If no suitable slots are found within 30 minutes, inform the user that you couldn't find anything close to their requested time and offer to check other times.
          Always confirm the booking details (restaurant name, date, time, party size, and platform if specified) with the user and provide a confirmation number if a booking is successful.
          Always respond clearly and concisely.`,
      },
    });
  }

  async sendMessage(userMessage: string): Promise<{ text: string; functionCalls?: FunctionCallMessage[]; toolResponses?: ToolResponseMessage[] }> {
    if (!this.chat) {
      this.initChat(); // Re-initialize if chat somehow became null
    }

    try {
      const chatResponse = await this.chat!.sendMessage({ message: userMessage });
      const agentText = chatResponse.text || '';
      const functionCalls: FunctionCallMessage[] = [];
      const toolResponses: ToolResponseMessage[] = [];

      if (chatResponse.functionCalls && chatResponse.functionCalls.length > 0) {
        for (const fc of chatResponse.functionCalls) {
          const functionName = fc.name;
          const functionArgs = fc.args as Record<string, any>;
          functionCalls.push({
            id: `fc-${Date.now()}-${Math.random()}`,
            sender: 'tool',
            text: `Calling tool: ${functionName} with arguments: ${JSON.stringify(functionArgs)}`,
            functionCall: { name: functionName, args: functionArgs },
          });

          if (this.toolFunctions[functionName]) {
            console.log(`Executing tool: ${functionName} with args:`, functionArgs);
            let toolResult;
            if (functionName === 'check_restaurant_availability') {
              toolResult = await this.toolFunctions[functionName](
                functionArgs.restaurant_name,
                functionArgs.date,
                functionArgs.time,
                functionArgs.partySize,
                functionArgs.platform
              );
            } else if (functionName === 'book_table') {
              toolResult = await this.toolFunctions[functionName](
                functionArgs.restaurant_name,
                functionArgs.date,
                functionArgs.time, // This corresponds to confirmed_time in the description
                functionArgs.partySize
              );
            } else {
              toolResult = { error: `Function ${functionName} not handled.` };
            }

            console.log(`Tool ${functionName} result:`, toolResult);

            toolResponses.push({
              id: `tr-${Date.now()}-${Math.random()}`,
              sender: 'tool',
              text: `Tool ${functionName} responded: ${JSON.stringify(toolResult)}`,
              toolResponse: { name: functionName, result: toolResult },
            });

            // Send tool response back to the model
            // DO NOT use toolResponses directly in sendMessage; instead, use contents with functionResponse.
            const toolResponseResult = await this.chat!.sendMessage({
              // The tool response needs to be wrapped in 'contents' as a 'functionResponse' part.
              contents: [{
                functionResponse: {
                  id: fc.id, // Use the ID from the original function call
                  name: fc.name,
                  response: { result: toolResult },
                },
              }],
            });

            // The agent's final response after receiving tool output
            const finalAgentText = toolResponseResult.text || '';
            return {
              text: finalAgentText,
              functionCalls,
              toolResponses
            };

          } else {
            const errorResult = { error: `Function ${functionName} not found.` };
            toolResponses.push({
              id: `tr-${Date.now()}-${Math.random()}`,
              sender: 'tool',
              text: `Tool ${functionName} responded with error: ${JSON.stringify(errorResult)}`,
              toolResponse: { name: functionName, result: errorResult },
            });

            // Also send error back to model
            // DO NOT use toolResponses directly in sendMessage; instead, use contents with functionResponse.
            const toolErrorResponse = await this.chat!.sendMessage({
              // The tool response needs to be wrapped in 'contents' as a 'functionResponse' part.
              contents: [{
                functionResponse: {
                  id: fc.id, // Use the ID from the original function call
                  name: fc.name,
                  response: { result: errorResult },
                },
              }],
            });
            const errorAgentText = toolErrorResponse.text || '';
            return {
              text: errorAgentText,
              functionCalls,
              toolResponses
            };
          }
        }
      }

      return { text: agentText, functionCalls, toolResponses };

    } catch (error: any) {
      console.error("Gemini API error:", error);
      // Check for specific error message indicating model thought budget exhaustion
      if (error.message && error.message.includes("400 Bad Request") && error.message.includes("requested entity was not found")) {
        // This often happens if the model thought too much and the effective token limit for output was too small.
        // It's also a common error for API key issues in some environments.
        return { text: "I encountered an issue processing your request. Please try again or re-select your API key if prompted." };
      }
      return { text: `Sorry, I encountered an error: ${error.message}` };
    }
  }
}