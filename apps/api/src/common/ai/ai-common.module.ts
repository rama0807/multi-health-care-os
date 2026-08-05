import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import { AiClientService } from './ai-client.service'
import { AI_PROVIDER_ADAPTER, AiProviderAdapter } from './ai-provider.interface'
import { AnthropicProvider } from './providers/anthropic.provider'
import { GeminiProvider } from './providers/gemini.provider'
import { OllamaProvider } from './providers/ollama.provider'
import { OpenAiProvider } from './providers/openai.provider'

/**
 * Mirrors `StorageModule`: every adapter is instantiated, and a factory picks
 * one from config. Domain modules only ever see `AiClientService`, so changing
 * providers is a config change rather than a code change (ADR-0023).
 */
@Global()
@Module({
  providers: [
    OpenAiProvider,
    AnthropicProvider,
    GeminiProvider,
    OllamaProvider,
    {
      provide: AI_PROVIDER_ADAPTER,
      useFactory: (
        config: ConfigService,
        openai: OpenAiProvider,
        anthropic: AnthropicProvider,
        gemini: GeminiProvider,
        ollama: OllamaProvider,
      ): AiProviderAdapter => {
        switch (config.get<string>('ai.provider')) {
          case 'ANTHROPIC':
            return anthropic
          case 'GEMINI':
            return gemini
          case 'OLLAMA':
            return ollama
          default:
            return openai
        }
      },
      inject: [ConfigService, OpenAiProvider, AnthropicProvider, GeminiProvider, OllamaProvider],
    },
    AiClientService,
  ],
  exports: [AiClientService],
})
export class AiCommonModule {}
