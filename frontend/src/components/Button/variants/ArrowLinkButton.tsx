import Icon from "@/components/Icon";
import { ButtonBase, type ButtonProps } from "../Button";

export default function ArrowLinkButton({
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <ButtonBase
      {...props}
      className={`group flex items-center justify-between gap-4 text-left cursor-pointer ${className}`.trim()}
      unstyled
    >
      <span className="flex justify-center items-center rounded-full h-10 w-10 bg-accent">
        <Icon icon="lu:arrow-up-right" size="lg" className="text-bg p-0" />
      </span>
    </ButtonBase>
  );
}
