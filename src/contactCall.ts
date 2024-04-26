import { createPublicClient, http } from 'viem';
import { SPHERE_QUIZ_NFT_ADDRESS } from './config';
import { scrollSepolia } from 'viem/chains';
import SphereQuizGameNFTAbi from './abi/SphereQuizGameNFT.json';

const viemClient = createPublicClient({
  chain: scrollSepolia,
  transport: http(),
});

export async function getbossHp(): Promise<any> {
  try {
    const bossHp = await viemClient.readContract({
      address: SPHERE_QUIZ_NFT_ADDRESS,
      abi: SphereQuizGameNFTAbi.abi,
      functionName: 'bossHP',
      //   args: [],
    });
    return bossHp;
  } catch (error) {
    console.error('Error in bossHP:', error || 'Could not get player stage status');
    throw error; // Rethrow the error for handling by the caller
  }
}
