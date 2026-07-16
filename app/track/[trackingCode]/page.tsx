import TrackingView from '@/components/public/TrackingView';

export default async function TrackingPage({ params }: { params: Promise<{ trackingCode: string }> }) { return <TrackingView code={(await params).trackingCode} />; }
