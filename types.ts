

export interface Message {
  id: string;
  sender: 'user' | 'agent' | 'tool' | 'system';
  text: string;
  isMarkdown?: boolean;
}

export interface FunctionCallMessage extends Message {
  functionCall: {
    name: string;
    args: Record<string, any>;
  };
}

export interface ToolResponseMessage extends Message {
  toolResponse: {
    name: string;
    result: any;
  };
}

export interface AvailableSlot {
  time: string;
  isAvailable: boolean;
}

export interface RestaurantAvailabilityResult {
  available: boolean;
  availableSlots?: AvailableSlot[];
  message?: string;
}

export interface BookingResult {
  success: boolean;
  confirmationNumber?: string;
  message?: string;
}
