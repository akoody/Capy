import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

const GoalCardSkeleton = () => {
  return (
    <SkeletonTheme baseColor="rgba(255, 255, 255, 0.05)" highlightColor="rgba(255, 255, 255, 0.1)">
      <div className="bg-white/10 p-5 rounded-2xl shadow-lg border border-white/10 backdrop-blur-md">
        <div className="flex items-center">
          <Skeleton circle width={48} height={48} />
          <div className="flex-grow ml-4">
            <h3 className="font-bold text-lg">
              <Skeleton width={150} />
            </h3>
            <p className="text-sm">
              <Skeleton width={200} />
            </p>
          </div>
        </div>
        <div className="mt-4">
          <Skeleton height={10} />
        </div>
      </div>
    </SkeletonTheme>
  );
};

export default GoalCardSkeleton;
