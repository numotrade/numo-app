import Popover from "../../core/popover";
import Link from "next/link";
import { FaDiscord } from "react-icons/fa";
import { ImBook, ImGithub, ImTwitter } from "react-icons/im";
import { IoIosArrowDown } from "react-icons/io";
import { SiMedium } from "react-icons/si";

const size = 20;

export default function More() {
  return (
    <Popover
      placement="bottom-start"
      className="hidden sm:flex"
      button={
        <div className="flex items-center gap-2 px-2 py-1 hover:opacity-80">
          <p className="p2 text-white">More</p>
          <IoIosArrowDown className="transform fill-white duration-300 ui-open:-rotate-180" />
        </div>
      }
      contents={
        <div className="grid rounded-xl bg-gray-900 p-1">
          <Link
            rel="noopener noreferrer"
            target="_blank"
            className="resource-item"
            href="https://numoen.gitbook.io/numoen"
          >
            <ImBook size={size} />

            <p>Documentation</p>
          </Link>
          <Link
            rel="noopener noreferrer"
            target="_blank"
            className="resource-item"
            href="https://discord.gg/V745FmMN2B"
          >
            <FaDiscord size={size} />

            <p>Discord</p>
          </Link>
          <Link
            rel="noopener noreferrer"
            target="_blank"
            className="resource-item"
            href="https://github.com/numoen"
          >
            <ImGithub size={size} />
            <p>Github</p>
          </Link>
          <Link
            rel="noopener noreferrer"
            target="_blank"
            className="resource-item"
            href="https://twitter.com/numoen"
          >
            <ImTwitter size={size} />
            <p>Twitter</p>
          </Link>
          <Link
            className="resource-item"
            href="https://medium.com/numoen"
            rel="noopener noreferrer"
            target="_blank"
          >
            <SiMedium size={size} />
            <p>Blog</p>
          </Link>
        </div>
      }
    />
  );
}
