// OpenAI-compatible chat completion request
export interface ChatCompletionRequest {
	model: string
	messages: ChatMessage[]
	temperature?: number
	top_p?: number
	max_tokens?: number
	stream?: boolean
	stop?: string | string[]
	presence_penalty?: number
	frequency_penalty?: number
	user?: string
}

export interface ChatMessage {
	role: 'system' | 'user' | 'assistant' | 'tool'
	content: string | ContentPart[]
	name?: string
	tool_calls?: ToolCall[]
	tool_call_id?: string
}

export interface ContentPart {
	type: 'text' | 'image_url'
	text?: string
	image_url?: { url: string; detail?: 'auto' | 'low' | 'high' }
}

export interface ToolCall {
	id: string
	type: 'function'
	function: { name: string; arguments: string }
}

// OpenAI-compatible chat completion response
export interface ChatCompletionResponse {
	id: string
	object: 'chat.completion'
	created: number
	model: string
	choices: ChatChoice[]
	usage: TokenUsage
}

export interface ChatChoice {
	index: number
	message: ChatMessage
	finish_reason: 'stop' | 'length' | 'tool_calls' | null
}

// Streaming chunk
export interface ChatCompletionChunk {
	id: string
	object: 'chat.completion.chunk'
	created: number
	model: string
	choices: ChatChunkChoice[]
	usage?: TokenUsage | null
}

export interface ChatChunkChoice {
	index: number
	delta: Partial<ChatMessage>
	finish_reason: 'stop' | 'length' | 'tool_calls' | null
}

export interface TokenUsage {
	prompt_tokens: number
	completion_tokens: number
	total_tokens: number
}

// Provider request (what adapters return after transforming)
export interface ProviderRequest {
	url: string
	headers: Record<string, string>
	body: string
}
