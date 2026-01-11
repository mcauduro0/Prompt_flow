import Link from 'next/link';
import {
  Inbox,
  FileSearch,
  Lightbulb,
  History,
  Settings,
  ArrowRight,
} from 'lucide-react';

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          ARC Investment Factory
        </h1>
        <p className="text-xl text-gray-600">
          AI-powered investment idea generation and deep research platform
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Lane A Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Inbox className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Lane A</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Daily idea discovery pipeline. Generates and filters investment ideas
            from global universe.
          </p>
          <div className="text-sm text-gray-500 mb-4">
            <div>Schedule: 06:00 America/Sao_Paulo (Mon-Fri)</div>
            <div>Daily limit: 120 ideas</div>
          </div>
          <Link
            href="/inbox"
            className="inline-flex items-center text-blue-600 hover:text-blue-700 font-medium"
          >
            View Inbox <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        {/* Lane B Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-green-100 rounded-lg">
              <FileSearch className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Lane B</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Deep research pipeline. 7 specialized agents analyze promoted ideas
            in parallel.
          </p>
          <div className="text-sm text-gray-500 mb-4">
            <div>Schedule: 08:00 America/Sao_Paulo (Mon-Fri)</div>
            <div>Weekly limit: 10 packets</div>
          </div>
          <Link
            href="/queue"
            className="inline-flex items-center text-green-600 hover:text-green-700 font-medium"
          >
            View Queue <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        {/* Packets Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-purple-100 rounded-lg">
              <Lightbulb className="h-6 w-6 text-purple-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Research Packets</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Completed deep research with 7 modules, scenarios, and decision briefs.
          </p>
          <Link
            href="/packets"
            className="inline-flex items-center text-purple-600 hover:text-purple-700 font-medium"
          >
            View Packets <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>

        {/* Run History Card */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="p-2 bg-gray-100 rounded-lg">
              <History className="h-6 w-6 text-gray-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">Run History</h2>
          </div>
          <p className="text-gray-600 mb-4">
            Audit trail of all DAG runs with timing, counts, and error logs.
          </p>
          <Link
            href="/runs"
            className="inline-flex items-center text-gray-600 hover:text-gray-700 font-medium"
          >
            View History <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
