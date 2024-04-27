import { createPublicClient, http } from 'viem';
import { BOSS_STATS_ADDRESS } from './config';
import { sepolia } from 'viem/chains';
import BossStatsAbi from './abi/BossStats.json';

const viemClient = createPublicClient({
  chain: sepolia,
  transport: http(),
});

interface AttackParameters {
  baseAttackPower: number;
  adjustedVolatility: number;
  overallAttackParameter: number;
}

export async function getAttackParametersFromContract(): Promise<AttackParameters> {
  try {
    const data = await viemClient.readContract({
      address: BOSS_STATS_ADDRESS,
      abi: BossStatsAbi.abi,
      functionName: 'getAttackParameters',
    });

    if (!Array.isArray(data) || data.some((item) => typeof item !== 'bigint')) {
      throw new Error('Data is not in the expected format');
    }

    const attackParameters: AttackParameters = {
      baseAttackPower: Number(data[0]) / 100,
      adjustedVolatility: Number(data[1]),
      overallAttackParameter: Number(data[2]) / 100, // Convert to decimal format
    };

    return attackParameters;
  } catch (error) {
    console.error('Error in getAttackParameters:', error || 'Could not get attack parameters');
    throw error; // Rethrow the error for handling by the caller
  }
}
